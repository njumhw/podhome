import { processAudioInternal } from '../src/server/audio-processor';

async function testShortAudioAsr() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 测试短音频播客处理（验证修复是否生效）');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 使用一个已知的短播客链接（约30分钟，用于快速测试）
  // 或者使用用户提供的链接
  const testPodcastUrl = process.argv[2] || 'https://www.xiaoyuzhoufm.com/episode/671986228956330d702cc6fc';
  
  console.log(`测试播客链接: ${testPodcastUrl}\n`);

  try {
    const startTime = Date.now();
    console.log(`开始时间: ${new Date().toISOString()}\n`);
    
    // 直接调用 processAudioInternal，这会测试完整的流程
    console.log('开始处理播客（包括ASR转写）...\n');
    const result = await processAudioInternal(testPodcastUrl, undefined, undefined, true);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ 处理完成！');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`处理时间: ${duration} 秒 (${Math.round(duration / 60)} 分钟)`);
    console.log(`播客ID: ${result.podcastId || '未知'}`);
    console.log(`标题: ${result.title || '未知'}`);
    console.log(`状态: ${result.status || '未知'}`);
    console.log(`ASR原文长度: ${result.asrTranscript?.length || 0} 字符`);
    console.log(`总结长度: ${result.summary?.length || 0} 字符`);
    
    if (result.asrTranscript && result.asrTranscript.length > 0) {
      console.log('\n✅ ASR转写成功！修复已生效。');
      console.log(`   ASR文本预览: ${result.asrTranscript.substring(0, 200)}...`);
    } else {
      console.log('\n⚠️  ASR转写结果为空，可能仍有问题。');
    }
    
    if (result.summary && result.summary.length > 0) {
      console.log('\n✅ 报告生成成功！');
    } else {
      console.log('\n⚠️  报告生成失败或为空。');
    }

  } catch (error: any) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.error('\n❌ 处理失败！');
    console.error('═══════════════════════════════════════════════════════════\n');
    console.error(`处理时间: ${duration} 秒`);
    console.error(`错误: ${error.message}`);
    
    if (error.message.includes('所有分段均无有效文本')) {
      console.error('\n🔍 错误分析:');
      console.error('  - 所有ASR分段都返回了空文本');
      console.error('  - 可能原因：');
      console.error('    1. OSS URL无法被ASR API访问');
      console.error('    2. 音频文件格式问题');
      console.error('    3. ASR API调用失败');
    } else if (error.message.includes('url error')) {
      console.error('\n🔍 错误分析:');
      console.error('  - ASR API返回URL错误');
      console.error('  - 可能原因：');
      console.error('    1. OSS URL格式不正确');
      console.error('    2. OSS bucket权限问题');
      console.error('    3. ASR API无法访问OSS URL');
    } else if (error.message.includes('超时')) {
      console.error('\n🔍 错误分析:');
      console.error('  - ASR处理超时');
      console.error('  - 可能原因：');
      console.error('    1. ASR API服务响应慢');
      console.error('    2. 网络连接问题');
    }
    
    if (error.stack) {
      console.error('\n错误堆栈:', error.stack.substring(0, 1000));
    }
    
    process.exit(1);
  } finally {
    // 确保数据库连接关闭
    const { db } = await import('../src/server/db');
    await db.$disconnect();
  }
}

testShortAudioAsr().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});

