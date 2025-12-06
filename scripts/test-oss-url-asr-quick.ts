import { uploadToOssAndGetPublicUrl } from '../src/server/storage';
import { qwenTranscribeFromUrl } from '../src/clients/qwen-asr';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function testOssUrlAsrQuick() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 快速测试：OSS URL生成和ASR API调用');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 使用一个已知的短音频URL（约2分钟）
  const testAudioUrl = 'https://media.xyzcdn.net/670f3da40d2f24f28978736f/luaVbC8wX-1WxLZShoambf9-zHTY.m4a';
  
  console.log(`测试音频URL: ${testAudioUrl}\n`);

  try {
    // 步骤1: 下载音频文件
    console.log('步骤1: 下载音频文件...');
    const audioRes = await fetch(testAudioUrl);
    if (!audioRes.ok) {
      throw new Error(`下载失败: HTTP ${audioRes.status}`);
    }
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    console.log(`✅ 下载成功，文件大小: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);

    // 步骤2: 上传到OSS并获取URL
    console.log('步骤2: 上传到OSS并获取URL...');
    const ossPath = `test/asr-fix-verification-${Date.now()}.m4a`;
    const ossUrl = await uploadToOssAndGetPublicUrl(ossPath, audioBuffer, 'audio/mp4');
    
    if (!ossUrl) {
      console.error('❌ OSS上传失败，无法生成URL');
      return;
    }
    
    console.log(`✅ OSS URL生成成功`);
    console.log(`   URL: ${ossUrl.substring(0, 120)}...`);
    
    // 检查URL类型
    if (ossUrl.includes('?')) {
      console.log(`   ⚠️  使用的是签名URL（包含查询参数）`);
      console.log(`   ❌ 这不符合预期，应该使用公共URL`);
    } else {
      console.log(`   ✅ 使用的是公共URL（无查询参数）- 符合预期`);
    }
    console.log('');

    // 步骤3: 验证OSS URL可访问性
    console.log('步骤3: 验证OSS URL可访问性...');
    try {
      const testRes = await fetch(ossUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      if (testRes.ok) {
        console.log(`✅ OSS URL可访问 (HTTP ${testRes.status})`);
      } else {
        console.error(`❌ OSS URL不可访问 (HTTP ${testRes.status})`);
        return;
      }
    } catch (error: any) {
      console.error(`❌ OSS URL访问测试失败: ${error.message}`);
      return;
    }
    console.log('');

    // 步骤4: 使用OSS URL调用ASR API（只测试第一个片段，快速验证）
    console.log('步骤4: 使用OSS URL调用ASR API...');
    console.log('   这可能需要1-2分钟...\n');
    
    const asrStartTime = Date.now();
    try {
      const asrResult = await qwenTranscribeFromUrl(ossUrl);
      const asrDuration = Math.round((Date.now() - asrStartTime) / 1000);
      
      if (asrResult.text && asrResult.text.trim().length > 0) {
        console.log(`✅ ASR成功！`);
        console.log(`   耗时: ${asrDuration} 秒`);
        console.log(`   文本长度: ${asrResult.text.length} 字符`);
        console.log(`   文本预览: ${asrResult.text.substring(0, 200)}...`);
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ 修复验证成功！');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('OSS URL生成和ASR API调用都正常工作。');
        console.log('修复已生效，可以正常处理播客了。');
      } else {
        console.error('❌ ASR返回空文本');
        console.error('   这说明ASR API无法访问OSS URL或音频文件有问题');
        console.error('   需要进一步检查OSS bucket权限配置');
      }
    } catch (error: any) {
      const asrDuration = Math.round((Date.now() - asrStartTime) / 1000);
      console.error(`❌ ASR失败 (耗时: ${asrDuration}秒)`);
      console.error(`   错误: ${error.message}`);
      
      if (error.message.includes('url error')) {
        console.error('');
        console.error('⚠️  ASR API返回"url error"，说明无法访问OSS URL');
        console.error('   可能原因：');
        console.error('   1. OSS bucket不是公共读（bucket级别）');
        console.error('   2. OSS URL格式问题');
        console.error('   3. ASR API网络限制');
      } else if (error.message.includes('超时') || error.message.includes('timeout')) {
        console.error('');
        console.error('⚠️  ASR处理超时');
        console.error('   可能原因：');
        console.error('   1. ASR API服务响应慢');
        console.error('   2. 网络连接问题');
      } else if (error.message.includes('连续失败')) {
        console.error('');
        console.error('⚠️  网络错误连续失败');
        console.error('   可能原因：');
        console.error('   1. 网络连接不稳定');
        console.error('   2. ASR API服务不可用');
      } else if (error.message.includes('长时间未改变')) {
        console.error('');
        console.error('⚠️  任务状态长时间未改变');
        console.error('   可能原因：');
        console.error('   1. ASR API服务端任务卡住');
        console.error('   2. 音频文件格式问题');
      }
    }

  } catch (error: any) {
    console.error('\n❌ 测试过程出错:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack.substring(0, 500));
    }
  } finally {
    // 确保数据库连接关闭
    try {
      const { db } = await import('../src/server/db');
      await db.$disconnect();
    } catch (e) {
      // 忽略关闭错误
    }
  }
}

testOssUrlAsrQuick().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});

