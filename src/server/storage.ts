import { createClient } from "@supabase/supabase-js";
import OSS from "ali-oss";

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Do not throw at import time in dev; callers should handle null
}

export function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function ensureBucket(bucket: string) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { data: list } = await sb.storage.listBuckets();
  const existing = (list || []).find((b) => b.name === bucket);
  if (!existing) {
    await sb.storage.createBucket(bucket, { public: true });
  } else if (!existing.public) {
    // Force set to public if previously created as private
    await sb.storage.updateBucket(bucket, { public: true });
  }
}

export async function uploadAndSign(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  await ensureBucket(bucket);
  await sb.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  });
  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// Upload and return public URL (bucket must be public). Used when 3rd-party needs direct access.
export async function uploadAndGetPublicUrl(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  await ensureBucket(bucket);
  await sb.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  });
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
}


// ---------- Aliyun OSS helpers ----------
// 改为运行时读取环境变量，而不是模块加载时
function getOssEnv() {
  return {
    OSS_ACCESS_KEY_ID: process.env.ALIYUN_ACCESS_KEY_ID as string | undefined,
    OSS_ACCESS_KEY_SECRET: process.env.ALIYUN_ACCESS_KEY_SECRET as string | undefined,
    OSS_REGION: process.env.ALIYUN_OSS_REGION as string | undefined, // e.g. cn-hangzhou
    OSS_BUCKET: process.env.ALIYUN_OSS_BUCKET as string | undefined,
  };
}

function getOssClient(): OSS | null {
  const { OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_REGION, OSS_BUCKET } = getOssEnv();
  if (!OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_REGION || !OSS_BUCKET) {
    console.warn('OSS配置不完整:', {
      hasAccessKeyId: !!OSS_ACCESS_KEY_ID,
      hasAccessKeySecret: !!OSS_ACCESS_KEY_SECRET,
      hasRegion: !!OSS_REGION,
      hasBucket: !!OSS_BUCKET
    });
    return null;
  }
  try {
    // 确保region格式正确（如果已经是oss-开头，不再添加）
    const region = OSS_REGION.startsWith('oss-') ? OSS_REGION : `oss-${OSS_REGION}`;
    
    console.log('创建OSS客户端:', {
      region,
      bucket: OSS_BUCKET,
      hasAccessKeyId: !!OSS_ACCESS_KEY_ID,
      hasAccessKeySecret: !!OSS_ACCESS_KEY_SECRET
    });
    
    const client = new OSS({
      accessKeyId: OSS_ACCESS_KEY_ID,
      accessKeySecret: OSS_ACCESS_KEY_SECRET,
      region: region,
      bucket: OSS_BUCKET,
      timeout: 60000,
      secure: true, // 强制使用HTTPS
    });
    
    console.log('✅ OSS客户端创建成功');
    return client as unknown as OSS;
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('❌ 创建OSS客户端失败:', errorMessage);
    if (errorStack) {
      console.error('   错误堆栈:', errorStack.substring(0, 500));
    }
    return null;
  }
}

export async function uploadToOssAndGetPublicUrl(
  path: string,
  file: Buffer,
  contentType: string,
  maxRetries: number = 3
): Promise<string | null> {
  const { OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_REGION, OSS_BUCKET } = getOssEnv();
  const client = getOssClient();
  if (!client || !OSS_BUCKET || !OSS_REGION) {
    const errorDetails = {
      hasClient: !!client,
      hasBucket: !!OSS_BUCKET,
      hasRegion: !!OSS_REGION,
      hasAccessKeyId: !!OSS_ACCESS_KEY_ID,
      hasAccessKeySecret: !!OSS_ACCESS_KEY_SECRET,
      bucket: OSS_BUCKET,
      region: OSS_REGION
    };
    console.error('❌ OSS客户端未配置，无法上传文件', errorDetails);
    return null;
  }
  
  let lastError: any = null;
  
  // 重试机制：最多重试3次，指数退避
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        // 指数退避：第1次重试等待1秒，第2次等待2秒，第3次等待4秒
        const delay = Math.min(1000 * Math.pow(2, attempt - 2), 4000);
        console.log(`重试上传到OSS (${attempt}/${maxRetries}): ${path}，等待 ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.log(`开始上传到OSS: ${path} (${file.length} 字节)`);
      }
      
      // 验证文件大小（OSS有文件大小限制）
      const maxFileSize = 5 * 1024 * 1024 * 1024; // 5GB
      if (file.length > maxFileSize) {
        throw new Error(`文件过大: ${(file.length / 1024 / 1024).toFixed(2)} MB，超过OSS限制`);
      }
      
      // 验证文件不为空
      if (file.length === 0) {
        throw new Error(`文件为空，无法上传`);
      }
      
      const result = await client.put(path, file, { 
        headers: { 
          'Content-Type': contentType,
          'Content-Length': file.length.toString()
        } 
      });
      console.log(`✅ OSS上传成功: ${path} (${(file.length / 1024).toFixed(2)} KB)`, result.res?.status || 'OK');
      
      // 尝试将文件设置为公共读，这样ASR API可以直接访问
      try {
        await client.putACL(path, 'public-read');
        console.log(`✅ OSS文件ACL设置为公共读: ${path}`);
      } catch (aclError) {
        console.warn(`⚠️ 设置OSS文件ACL失败（可能bucket已设置为公共读）: ${aclError}`);
      }
      
      // 直接返回公共URL（回归到之前的简单逻辑，之前可以正常工作）
      // 确保region格式正确（如果已经是oss-开头，不再添加）
      const { OSS_REGION: currentRegion, OSS_BUCKET: currentBucket } = getOssEnv();
      const regionForUrl = currentRegion?.startsWith('oss-') ? currentRegion : `oss-${currentRegion}`;
      const publicUrl = `https://${currentBucket}.${regionForUrl}.aliyuncs.com/${encodeURI(path)}`;
      console.log(`✅ OSS公共URL生成成功: ${path}`);
      return publicUrl;
    } catch (error: any) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code;
      const errorStatus = (error as any)?.status;
      const errorRequestId = (error as any)?.requestId;
      const errorHostId = (error as any)?.hostId;
      
      // 提取OSS SDK的详细错误信息
      const ossErrorDetails: string[] = [];
      if (errorCode) ossErrorDetails.push(`错误代码: ${errorCode}`);
      if (errorStatus) ossErrorDetails.push(`HTTP状态: ${errorStatus}`);
      if (errorRequestId) ossErrorDetails.push(`请求ID: ${errorRequestId}`);
      if (errorHostId) ossErrorDetails.push(`主机ID: ${errorHostId}`);
      
      if (attempt < maxRetries) {
        console.warn(`⚠️ OSS上传失败 (${attempt}/${maxRetries}): ${path} - ${errorMessage}`);
        if (ossErrorDetails.length > 0) {
          console.warn(`   详细信息: ${ossErrorDetails.join(', ')}`);
        }
        console.warn(`   文件大小: ${(file.length / 1024).toFixed(2)} KB，将重试...`);
      } else {
        // 最后一次尝试失败，记录详细错误
        console.error(`❌ OSS上传失败 (${path}):`, errorMessage);
        console.error(`   完整错误对象:`, JSON.stringify({
          code: errorCode,
          status: errorStatus,
          requestId: errorRequestId,
          hostId: errorHostId,
          message: errorMessage,
          name: error instanceof Error ? error.name : 'Unknown'
        }, null, 2));
        if (ossErrorDetails.length > 0) {
          console.error(`   详细信息: ${ossErrorDetails.join(', ')}`);
        }
        console.error(`   文件大小: ${(file.length / 1024).toFixed(2)} KB`);
        console.error(`   Content-Type: ${contentType}`);
        console.error(`   OSS配置: bucket=${OSS_BUCKET}, region=${OSS_REGION}`);
        
        // 检查是否是常见的OSS错误
        if (errorCode === 'AccessDenied') {
          console.error(`   ⚠️ 访问被拒绝：请检查OSS权限配置`);
        } else if (errorCode === 'InvalidAccessKeyId' || errorCode === 'SignatureDoesNotMatch') {
          console.error(`   ⚠️ 认证失败：请检查OSS AccessKey配置`);
        } else if (errorCode === 'NoSuchBucket') {
          console.error(`   ⚠️ 存储桶不存在：请检查OSS_BUCKET配置`);
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
          console.error(`   ⚠️ 网络连接问题：请检查网络连接或OSS服务状态`);
        }
        
        const errorStack = error instanceof Error ? error.stack : undefined;
        if (errorStack) {
          console.error(`   错误堆栈: ${errorStack.substring(0, 1000)}`);
        }
      }
    }
  }
  
  // 所有重试都失败，返回null让调用者处理
  return null;
}




