import { processAudioInternal } from '../src/server/audio-processor';

/**
 * 测试播客处理
 * 直接调用 processAudioInternal，不依赖数据库连接
 */
async function testPodcastProcessing() {
  try {
    // 从命令行参数获取URL，如果没有则使用默认值
    const url = process.argv[2] || 'https://www.xiaoyuzhoufm.com/episode/692cd86fe4244f7e3d3ad135';
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 测试播客处理');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`播客链接: ${url}`);
    console.log(`开始时间: ${new Date().toISOString()}\n`);
    
    const startTime = Date.now();
    
    try {
      // 直接调用处理函数
      const result = await processAudioInternal(url, undefined, `test_${Date.now()}`);
      
      const duration = Date.now() - startTime;
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('✅ 播客处理完成！');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`总耗时: ${minutes}分${seconds}秒 (${duration}ms)`);
      console.log(`结果:`, result ? '成功' : '失败');
      
      if (result) {
        console.log('\n📊 处理结果:');
        if (result.summary) {
          console.log(`  总结长度: ${result.summary.length} 字符`);
          console.log(`  总结预览（前200字符）: ${result.summary.substring(0, 200)}...`);
        }
        if (result.outline) {
          console.log(`  大纲长度: ${result.outline.length} 字符`);
        }
      }
      
      console.log('\n✅ 测试完成！');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const duration = Date.now() - startTime;
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      
      console.error('\n═══════════════════════════════════════════════════════════');
      console.error('❌ 播客处理失败！');
      console.error('═══════════════════════════════════════════════════════════\n');
      console.error(`错误信息: ${errorMessage}`);
      console.error(`耗时: ${minutes}分${seconds}秒`);
      if (errorStack) {
        console.error(`错误堆栈: ${errorStack.substring(0, 1000)}`);
      }
      
      throw error;
    }
    
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
testPodcastProcessing();

