import 'dotenv/config';
import { uploadToOssAndGetPublicUrl } from '../src/server/storage';
import { qwenTranscribeFromUrl } from '../src/clients/qwen-asr';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function testAsrOssAccess() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 测试ASR API对OSS URL的访问');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. 检查ASR模型
  const asrModel = process.env.QWEN_ASR_MODEL || 'fun-asr';
  console.log(`1. ASR模型: ${asrModel}\n`);

  // 2. 创建一个小的测试音频文件（使用现有的音频文件或创建一个）
  console.log('2. 准备测试音频文件...');
  
  // 尝试使用一个已知的公共音频URL作为测试
  // 或者创建一个小的测试文件
  const testAudioUrl = 'https://media.xyzcdn.net/670f3da40d2f24f28978736f/luaVbC8wX-1WxLZShoambf9-zHTY.m4a';
  
  console.log(`   使用测试音频URL: ${testAudioUrl.substring(0, 80)}...`);
  console.log('');

  // 3. 测试直接使用公共URL进行ASR
  console.log('3. 测试直接使用公共URL进行ASR...');
  try {
    console.log('   调用ASR API（使用公共URL）...');
    const result = await qwenTranscribeFromUrl(testAudioUrl);
    
    if (result.text && result.text.trim().length > 0) {
      console.log(`   ✅ ASR成功，文本长度: ${result.text.length} 字符`);
      console.log(`   文本预览: ${result.text.substring(0, 100)}...`);
    } else {
      console.error('   ❌ ASR返回空文本');
    }
  } catch (error: any) {
    console.error(`   ❌ ASR失败: ${error.message}`);
    if (error.message.includes('url error')) {
      console.error('   ⚠️  ASR API无法访问URL（url error）');
    }
  }
  console.log('');

  // 4. 测试使用OSS URL进行ASR
  console.log('4. 测试使用OSS URL进行ASR...');
  try {
    // 下载测试音频文件
    console.log('   下载测试音频文件...');
    const audioRes = await fetch(testAudioUrl);
    if (!audioRes.ok) {
      throw new Error(`下载失败: HTTP ${audioRes.status}`);
    }
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    console.log(`   ✅ 下载成功，文件大小: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

    // 上传到OSS
    console.log('   上传到OSS...');
    const ossPath = `test/asr-oss-access-test-${Date.now()}.m4a`;
    const ossUrl = await uploadToOssAndGetPublicUrl(ossPath, audioBuffer, 'audio/mp4');
    
    if (!ossUrl) {
      console.error('   ❌ OSS上传失败');
      return;
    }
    
    console.log(`   ✅ OSS URL生成成功: ${ossUrl.substring(0, 100)}...`);
    
    // 验证OSS URL可访问性
    console.log('   验证OSS URL可访问性...');
    try {
      const testRes = await fetch(ossUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      if (testRes.ok) {
        console.log(`   ✅ OSS URL可访问 (HTTP ${testRes.status})`);
      } else {
        console.error(`   ❌ OSS URL不可访问 (HTTP ${testRes.status})`);
      }
    } catch (error: any) {
      console.error(`   ❌ OSS URL访问测试失败: ${error.message}`);
    }
    
    // 使用OSS URL进行ASR
    console.log('   使用OSS URL调用ASR API...');
    const asrResult = await qwenTranscribeFromUrl(ossUrl);
    
    if (asrResult.text && asrResult.text.trim().length > 0) {
      console.log(`   ✅ ASR成功，文本长度: ${asrResult.text.length} 字符`);
      console.log(`   文本预览: ${asrResult.text.substring(0, 100)}...`);
    } else {
      console.error('   ❌ ASR返回空文本');
      console.error('   ⚠️  这可能说明ASR API无法访问OSS URL，即使URL可以访问');
    }
  } catch (error: any) {
    console.error(`   ❌ OSS URL ASR测试失败: ${error.message}`);
    if (error.message.includes('url error')) {
      console.error('   ⚠️  ASR API返回"url error"，说明无法访问OSS URL');
      console.error('   可能原因：');
      console.error('   1. OSS bucket不是公共读');
      console.error('   2. OSS URL格式问题');
      console.error('   3. ASR API网络限制');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 测试总结');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('如果OSS URL ASR测试失败，可能的原因：');
  console.log('1. OSS bucket权限问题（需要设置为公共读）');
  console.log('2. OSS URL格式问题（ASR API可能不支持某些格式）');
  console.log('3. ASR API网络限制（无法访问OSS）');
  console.log('4. 音频文件格式问题');
}

testAsrOssAccess().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});

