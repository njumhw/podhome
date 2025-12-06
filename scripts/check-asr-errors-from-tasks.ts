import { db } from '../src/server/db';

async function checkAsrErrorsFromTasks() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 从任务中提取ASR错误信息');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 查找所有包含ASR错误的失败任务
    const failedTasks = await db.taskQueue.findMany({
      where: {
        OR: [
          { error: { contains: 'ASR' } },
          { error: { contains: '所有分段均无有效文本' } },
          { error: { contains: 'url error' } }
        ]
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 10
    });

    if (failedTasks.length === 0) {
      console.log('✅ 没有发现包含ASR错误的失败任务\n');
      return;
    }

    console.log(`找到 ${failedTasks.length} 个包含ASR错误的失败任务：\n`);

    for (const task of failedTasks) {
      const data = task.data as any;
      const url = data?.url || '未知';
      const shortUrl = url.length > 60 ? url.substring(0, 60) + '...' : url;
      
      console.log(`任务ID: ${task.id}`);
      console.log(`  URL: ${shortUrl}`);
      console.log(`  状态: ${task.status}`);
      console.log(`  错误: ${task.error?.substring(0, 300)}${task.error && task.error.length > 300 ? '...' : ''}`);
      console.log(`  时间: ${task.updatedAt.toLocaleString('zh-CN')}`);
      
      // 分析错误类型
      const errorMsg = task.error || '';
      if (errorMsg.includes('所有分段均无有效文本')) {
        console.log(`  🔍 错误类型: 所有ASR分段返回空文本`);
        console.log(`     可能原因: ASR API无法访问OSS URL或音频文件格式问题`);
      } else if (errorMsg.includes('url error')) {
        console.log(`  🔍 错误类型: ASR API返回URL错误`);
        console.log(`     可能原因: OSS URL格式问题或ASR API无法访问OSS`);
      } else if (errorMsg.includes('ASR转写失败')) {
        console.log(`  🔍 错误类型: ASR转写失败`);
        console.log(`     可能原因: ASR API调用失败或网络问题`);
      } else if (errorMsg.includes('超时')) {
        console.log(`  🔍 错误类型: ASR处理超时`);
        console.log(`     可能原因: ASR API响应慢或任务卡住`);
      }
      
      // 检查metrics
      if (task.metrics) {
        const metrics = task.metrics as any;
        if (metrics.processingSteps?.asr) {
          console.log(`  ASR状态: ${metrics.processingSteps.asr.status}`);
          if (metrics.processingSteps.asr.duration) {
            console.log(`  ASR耗时: ${Math.round(metrics.processingSteps.asr.duration / 1000)}秒`);
          }
        }
        if (metrics.asrSegmentsCount !== undefined) {
          console.log(`  ASR分段数: ${metrics.asrSegmentsCount}`);
        }
      }
      
      console.log('');
    }

    // 统计错误类型
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 错误类型统计');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const errorTypes: Record<string, number> = {};
    for (const task of failedTasks) {
      const errorMsg = task.error || '';
      if (errorMsg.includes('所有分段均无有效文本')) {
        errorTypes['所有分段均无有效文本'] = (errorTypes['所有分段均无有效文本'] || 0) + 1;
      } else if (errorMsg.includes('url error')) {
        errorTypes['url error'] = (errorTypes['url error'] || 0) + 1;
      } else if (errorMsg.includes('超时')) {
        errorTypes['超时'] = (errorTypes['超时'] || 0) + 1;
      } else {
        errorTypes['其他ASR错误'] = (errorTypes['其他ASR错误'] || 0) + 1;
      }
    }
    
    for (const [type, count] of Object.entries(errorTypes)) {
      console.log(`  ${type}: ${count} 次`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('💡 建议');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('1. 如果错误是"所有分段均无有效文本"：');
    console.log('   - 检查OSS bucket是否设置为公共读（bucket级别）');
    console.log('   - 检查OSS URL格式是否正确');
    console.log('   - 检查ASR API是否能访问OSS URL');
    console.log('');
    console.log('2. 如果错误是"url error"：');
    console.log('   - 检查OSS URL格式');
    console.log('   - 检查OSS文件权限');
    console.log('');
    console.log('3. 如果错误是"超时"：');
    console.log('   - 检查ASR API服务状态');
    console.log('   - 检查网络连接');
    console.log('   - 检查音频文件大小和格式');

  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack.substring(0, 500));
    }
  } finally {
    await db.$disconnect();
  }
}

checkAsrErrorsFromTasks();

