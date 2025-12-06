/**
 * 测试 qwen3-asr-flash 模型对不同URL格式的支持
 * 尝试不同的URL格式，找出可以工作的格式
 */

import { qwenTranscribeFromUrl } from '../src/clients/qwen-asr';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import OSS from 'ali-oss';

// 手动加载环境变量（如果.env文件存在）
const fs = require('fs');
const path = require('path');
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
  console.log('✅ 环境变量已加载');
  console.log(`   ALIYUN_ACCESS_KEY_ID: ${process.env.ALIYUN_ACCESS_KEY_ID ? '已设置 (' + process.env.ALIYUN_ACCESS_KEY_ID.substring(0, 10) + '...)' : '未设置'}`);
  console.log(`   ALIYUN_ACCESS_KEY_SECRET: ${process.env.ALIYUN_ACCESS_KEY_SECRET ? '已设置' : '未设置'}`);
  console.log(`   ALIYUN_OSS_BUCKET: ${process.env.ALIYUN_OSS_BUCKET || '未设置'}`);
  console.log(`   ALIYUN_OSS_REGION: ${process.env.ALIYUN_OSS_REGION || '未设置'}\n`);
} else {
  console.log('⚠️ .env文件不存在，使用系统环境变量\n');
}

async function testQwen3AsrFlashUrls() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 测试 qwen3-asr-flash 模型对不同URL格式的支持');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 先下载大文件，然后提取前2分钟（确保小于3分钟和10MB限制）
  const largeAudioUrl = 'https://media.xyzcdn.net/670f3da40d2f24f28978736f/luaVbC8wX-1WxLZShoambf9-zHTY.m4a';
  
  console.log('📥 下载原始音频文件...');
  const response = await fetch(largeAudioUrl);
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status}`);
  }
  
  // 保存到临时文件
  const tmpDir = path.join(os.tmpdir(), 'podroom');
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, `source-${Date.now()}.m4a`);
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  await fs.promises.writeFile(tmpFile, audioBuffer);
  console.log(`✅ 下载成功，原始大小: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  // 使用ffmpeg提取前2分钟（120秒）
  const { exec } = require('child_process');
  const smallFile = path.join(tmpDir, `small-${Date.now()}.m4a`);
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
  
  console.log('✂️ 提取前2分钟音频（确保小于3分钟和10MB限制）...');
  await new Promise<void>((resolve, reject) => {
    exec(
      `${ffmpegPath} -i "${tmpFile}" -t 120 -c copy "${smallFile}" -y`,
      { timeout: 30000 },
      (error: any, stdout: any, stderr: any) => {
        if (error) {
          reject(new Error(`FFmpeg失败: ${error.message}`));
        } else {
          resolve();
        }
      }
    );
  });
  
  const smallBuffer = await fs.promises.readFile(smallFile);
  const smallSizeMB = smallBuffer.length / 1024 / 1024;
  console.log(`✅ 提取成功，小文件大小: ${smallSizeMB.toFixed(2)} MB\n`);
  
  // 清理临时文件
  await fs.promises.unlink(tmpFile).catch(() => {});
  
  // 测试不同的URL格式
  const testUrls: Array<{ name: string; url: string }> = [];

  // 2. 尝试上传到OSS（如果OSS配置可用）
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const ossRegion = process.env.ALIYUN_OSS_REGION;
  const ossBucket = process.env.ALIYUN_OSS_BUCKET;
  
  if (accessKeyId && accessKeySecret && ossRegion && ossBucket) {
    try {
      console.log('📥 下载测试音频...');
      const response = await fetch(testAudioUrl);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const fileSizeMB = audioBuffer.length / 1024 / 1024;
      console.log(`✅ 下载成功，大小: ${fileSizeMB.toFixed(2)} MB`);
      
      // 检查文件大小限制
      if (fileSizeMB > 10) {
        console.log(`⚠️ 警告：文件大小 ${fileSizeMB.toFixed(2)}MB 超过qwen3-asr-flash的10MB限制`);
        console.log(`   建议：使用音频分割功能，将文件分割成多个小于10MB的片段\n`);
      } else {
        console.log(`✅ 文件大小符合限制（< 10MB）\n`);
      }

      // 直接使用OSS SDK上传
      const region = ossRegion.startsWith('oss-') ? ossRegion : `oss-${ossRegion}`;
      const client = new OSS({
        accessKeyId,
        accessKeySecret,
        region,
        bucket: ossBucket,
        secure: true,
      });
      
      const testPath = `test/qwen3-asr-flash-test-${Date.now()}.m4a`;
      console.log('📤 上传到OSS...');
      
      await client.put(testPath, audioBuffer, {
        headers: {
          'Content-Type': 'audio/mp4',
          'Content-Length': audioBuffer.length.toString()
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
      
      // 生成不同的URL格式进行测试
      // 1. 公共URL（无查询参数）
      const publicUrl = `https://${ossBucket}.${region}.aliyuncs.com/${encodeURI(testPath)}`;
      testUrls.push({ name: 'OSS公共URL（无查询参数）', url: publicUrl });
      
      // 2. 签名URL（包含查询参数）
      const signedUrl = client.signatureUrl(testPath, {
        expires: 86400,
        method: 'GET'
      });
      const httpsSignedUrl = signedUrl.replace(/^http:\/\//, 'https://');
      testUrls.push({ name: 'OSS签名URL（包含查询参数）', url: httpsSignedUrl });
      
      // 验证公共URL是否可访问
      try {
        const testRes = await fetch(publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (testRes.ok) {
          console.log(`✅ OSS公共URL可访问: ${publicUrl}\n`);
        } else {
          console.log(`⚠️ OSS公共URL不可访问: HTTP ${testRes.status}\n`);
        }
      } catch (testError) {
        console.log(`⚠️ OSS公共URL测试失败: ${testError}\n`);
      }
      
    } catch (error: any) {
      console.log(`⚠️ OSS上传失败，跳过OSS URL测试: ${error.message}\n`);
    }
  } else {
    console.log('⚠️ OSS配置不完整，跳过OSS URL测试\n');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 开始测试不同的URL格式');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const testCase of testUrls) {
    console.log(`\n📋 测试: ${testCase.name}`);
    console.log(`   URL: ${testCase.url}`);
    console.log(`   URL包含查询参数: ${testCase.url.includes('?') ? '是' : '否'}`);
    
    try {
      const startTime = Date.now();
      
      // 使用 qwen3-asr-flash 模型测试
      const result = await testAsrWithModel(testCase.url, 'qwen3-asr-flash');
      
      const duration = Date.now() - startTime;
      console.log(`   ✅ 成功！耗时: ${(duration / 1000).toFixed(2)}秒`);
      console.log(`   转写文本长度: ${result.text?.length || 0} 字符`);
      if (result.text) {
        console.log(`   转写预览: ${result.text.substring(0, 100)}...`);
      }
      
      // 如果这个URL格式成功了，记录并返回
      console.log(`\n🎉 找到可用的URL格式: ${testCase.name}`);
      console.log(`   URL: ${testCase.url}`);
      return { success: true, url: testCase.url, format: testCase.name };
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ 失败: ${errorMessage}`);
      
      // 检查是否是URL错误
      if (errorMessage.includes('url error') || errorMessage.includes('InvalidParameter')) {
        console.log(`   ⚠️  这是URL格式问题，继续测试下一个格式...`);
      } else {
        console.log(`   ⚠️  其他错误，继续测试...`);
      }
    }
  }

  console.log('\n❌ 所有URL格式都失败了');
  return { success: false };
}

async function testAsrWithModel(audioUrl: string, model: string): Promise<{ text: string }> {
  // 临时设置环境变量
  const originalModel = process.env.QWEN_ASR_MODEL;
  process.env.QWEN_ASR_MODEL = model;
  
  try {
    const env = require('../src/utils/env').getEnv();
    const apiKey = (env.QWEN_API_KEY as string) || "";
    if (!apiKey) throw new Error("Missing QWEN_API_KEY in env");

    const submitEndpoint = "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
    const payload: any = {
      model: model,
      input: {
        file_urls: [audioUrl],
      },
      parameters: {
        timeout: 3600,
      },
    };

    // Step 1: Submit async task
    const submitRes = await fetch(submitEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });

    const submitText = await submitRes.text();
    let submitData: any = {};
    try { submitData = JSON.parse(submitText); } catch {}
    
    if (!submitRes.ok) {
      console.error("Qwen ASR submit error:", { endpoint: submitEndpoint, status: submitRes.status, body: submitText });
      throw new Error(submitData?.error?.message || submitData?.message || submitText || `ASR submit failed(${submitRes.status})`);
    }

    const taskId = submitData?.output?.task_id || submitData?.task_id;
    if (!taskId) {
      throw new Error("No task_id returned from ASR submit");
    }

    console.log(`   ASR任务已提交，task_id: ${taskId}`);

    // Step 2: Poll for results
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
        const texts = require('../src/clients/qwen-asr').collectTextsDeep(statusData?.output?.results || statusData?.results || []);
        const text = texts.join(" ").trim();
        return { text };
      } else if (taskStatus === "FAILED") {
        const errorMsg = statusData?.output?.message || statusData?.message || "ASR task failed";
        throw new Error(errorMsg);
      }
      // 继续轮询
    }

    throw new Error("ASR task timeout");
  } finally {
    // 恢复原始模型
    if (originalModel) {
      process.env.QWEN_ASR_MODEL = originalModel;
    } else {
      delete process.env.QWEN_ASR_MODEL;
    }
  }
}

// 运行测试
testQwen3AsrFlashUrls()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ 测试完成！找到可用的URL格式');
      process.exit(0);
    } else {
      console.log('\n❌ 测试完成！未找到可用的URL格式');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });

