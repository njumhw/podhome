/**
 * 测试 qwen3-asr-flash 模型使用小文件
 */

import OSS from 'ali-oss';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 手动加载环境变量
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line: string) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

async function testSmallFile() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 测试 qwen3-asr-flash 模型使用小文件（<3分钟，<10MB）');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 下载大文件并提取前2分钟
  const largeAudioUrl = 'https://media.xyzcdn.net/670f3da40d2f24f28978736f/luaVbC8wX-1WxLZShoambf9-zHTY.m4a';
  
  console.log('📥 下载原始音频文件...');
  const response = await fetch(largeAudioUrl);
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status}`);
  }
  
  const tmpDir = path.join(os.tmpdir(), 'podroom');
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `source-${Date.now()}.m4a`);
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  await fs.promises.writeFile(tmpFile, audioBuffer);
  console.log(`✅ 下载成功，原始大小: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  // 使用ffmpeg提取前2分钟（120秒）
  const smallFile = path.join(tmpDir, `small-${Date.now()}.m4a`);
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  
  console.log('✂️ 提取前2分钟音频（确保小于3分钟和10MB限制）...');
  try {
    await execAsync(
      `${ffmpegPath} -i "${tmpFile}" -t 120 -c copy "${smallFile}" -y`,
      { timeout: 30000 }
    );
  } catch (error: any) {
    throw new Error(`FFmpeg失败: ${error.message}`);
  }
  
  const smallBuffer = await fs.promises.readFile(smallFile);
  const smallSizeMB = smallBuffer.length / 1024 / 1024;
  console.log(`✅ 提取成功，小文件大小: ${smallSizeMB.toFixed(2)} MB\n`);
  
  // 清理原始文件
  await fs.promises.unlink(tmpFile).catch(() => {});
  
  // 上传到OSS
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const ossRegion = process.env.ALIYUN_OSS_REGION;
  const ossBucket = process.env.ALIYUN_OSS_BUCKET;
  
  if (!accessKeyId || !accessKeySecret || !ossRegion || !ossBucket) {
    throw new Error('OSS配置不完整');
  }
  
  const region = ossRegion.startsWith('oss-') ? ossRegion : `oss-${ossRegion}`;
  const client = new OSS({
    accessKeyId,
    accessKeySecret,
    region,
    bucket: ossBucket,
    secure: true,
  });
  
  const testPath = `test/qwen3-asr-flash-small-${Date.now()}.m4a`;
  console.log('📤 上传小文件到OSS...');
  
  await client.put(testPath, smallBuffer, {
    headers: {
      'Content-Type': 'audio/mp4',
      'Content-Length': smallBuffer.length.toString()
    }
  });
  console.log(`✅ OSS上传成功\n`);
  
  // 设置文件为公共读
  try {
    await client.putACL(testPath, 'public-read');
    console.log(`✅ OSS文件ACL设置为公共读\n`);
  } catch (aclError) {
    console.log(`⚠️ 设置ACL失败（可能bucket已设置为公共读）\n`);
  }
  
  // 生成公共URL（无查询参数）
  const publicUrl = `https://${ossBucket}.${region}.aliyuncs.com/${encodeURI(testPath)}`;
  console.log(`📝 OSS公共URL: ${publicUrl}`);
  
  // 验证URL可访问
  try {
    const testRes = await fetch(publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (testRes.ok) {
      const contentLength = testRes.headers.get('content-length');
      const contentType = testRes.headers.get('content-type');
      console.log(`✅ OSS公共URL可访问`);
      console.log(`   文件大小: ${contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) + ' MB' : '未知'}`);
      console.log(`   Content-Type: ${contentType || '未知'}\n`);
    } else {
      console.log(`⚠️ OSS公共URL不可访问: HTTP ${testRes.status}\n`);
    }
  } catch (testError) {
    console.log(`⚠️ OSS公共URL测试失败: ${testError}\n`);
  }
  
  // 测试qwen3-asr-flash - 尝试不同的API端点和参数格式
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 测试 qwen3-asr-flash 模型（尝试不同的API端点和参数格式）');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const env = require('../src/utils/env').getEnv();
  const apiKey = (env.QWEN_API_KEY as string) || "";
  if (!apiKey) throw new Error("Missing QWEN_API_KEY in env");

  // 尝试不同的API端点和参数格式
  const testCases = [
    {
      endpoint: "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
      payload: {
        model: "qwen3-asr-flash",
        input: { file_urls: [publicUrl] },
        parameters: { timeout: 3600 },
      },
      name: "标准格式（file_urls）"
    },
    {
      endpoint: "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
      payload: {
        model: "qwen3-asr-flash",
        input: { audio_url: publicUrl },
        parameters: { timeout: 3600 },
      },
      name: "audio_url格式"
    },
    {
      endpoint: "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
      payload: {
        model: "qwen3-asr-flash",
        input: { url: publicUrl },
        parameters: { timeout: 3600 },
      },
      name: "url格式"
    },
  ];
  
  let lastError: any = null;
  
  for (const testCase of testCases) {
    console.log(`\n📤 尝试: ${testCase.name}`);
    console.log(`   端点: ${testCase.endpoint}`);
    console.log(`   URL: ${publicUrl}\n`);
    
    try {
      const submitRes = await fetch(testCase.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify(testCase.payload),
        signal: AbortSignal.timeout(30000)
      });

      const submitText = await submitRes.text();
      let submitData: any = {};
      try { submitData = JSON.parse(submitText); } catch {}
      
      if (!submitRes.ok) {
        const errorMsg = submitData?.error?.message || submitData?.message || submitText;
        console.log(`   ❌ 失败: ${errorMsg}`);
        lastError = errorMsg;
        continue; // 尝试下一个格式
      }

      const taskId = submitData?.output?.task_id || submitData?.task_id;
      if (!taskId) {
        console.log(`   ❌ 失败: 未返回task_id`);
        continue;
      }

      console.log(`   ✅ ASR任务已提交，task_id: ${taskId}`);
      console.log(`   🎉 找到可用的API端点和参数格式: ${testCase.name}\n`);

      // 轮询结果
      console.log('⏳ 等待ASR处理完成...');
      const maxAttempts = 60; // 最多等待2分钟
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
          method: "GET",
          headers: {
            authorization: `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(15000)
        });

        const statusText = await statusRes.text();
        let statusData: any = {};
        try { statusData = JSON.parse(statusText); } catch {}
        
        if (!statusRes.ok) {
          throw new Error(statusData?.error?.message || statusData?.message || `ASR status check failed(${statusRes.status})`);
        }

        const taskStatus = statusData?.output?.task_status || statusData?.task_status;
        
        if (taskStatus === "SUCCEEDED") {
          const collectTextsDeep = require('../src/clients/qwen-asr').collectTextsDeep;
          const texts = collectTextsDeep(statusData?.output?.results || statusData?.results || []);
          const text = texts.join(" ").trim();
          
          console.log(`\n🎉 qwen3-asr-flash 转写成功！`);
          console.log(`   转写文本长度: ${text.length} 字符`);
          if (text) {
            console.log(`   转写预览: ${text.substring(0, 200)}...`);
          }
          
          // 清理临时文件
          await fs.promises.unlink(smallFile).catch(() => {});
          
          return { success: true, text, url: publicUrl, endpoint: testCase.endpoint, format: testCase.name };
        } else if (taskStatus === "FAILED") {
          const errorMsg = statusData?.output?.message || statusData?.message || "ASR task failed";
          throw new Error(errorMsg);
        }
        
        if (attempt % 10 === 0) {
          console.log(`   等待中... (${attempt}/${maxAttempts})`);
        }
      }

      throw new Error("ASR task timeout");
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes('url error') && !errorMsg.includes('InvalidParameter')) {
        // 如果不是URL错误，可能是其他问题，重新抛出
        throw error;
      }
      lastError = errorMsg;
    }
  }
  
  // 清理临时文件
  await fs.promises.unlink(smallFile).catch(() => {});
  
  throw new Error(`所有API端点和参数格式都失败。最后错误: ${lastError}`);
}

testSmallFile()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ 测试完成！qwen3-asr-flash 可以正常工作！');
      console.log(`   可用的URL格式: OSS公共URL（无查询参数）`);
      console.log(`   可用的API端点: ${result.endpoint}`);
      console.log(`   可用的参数格式: ${result.format}`);
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
