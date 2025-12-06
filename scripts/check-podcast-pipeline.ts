import { db } from '../src/server/db';

async function checkPodcastPipeline() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 播客处理链路完整性检查');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. 检查最近成功的任务
  console.log('1. 检查最近成功的任务...');
  const recentSuccess = await db.taskQueue.findMany({
    where: { status: 'READY' },
    orderBy: { completedAt: 'desc' },
    take: 3
  });
  
  if (recentSuccess.length > 0) {
    console.log(`   ✅ 找到 ${recentSuccess.length} 个最近成功的任务`);
    for (const task of recentSuccess) {
      const data = task.data as any;
      const url = data?.url || '未知';
      const shortUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;
      const duration = task.startedAt && task.completedAt 
        ? Math.round((task.completedAt.getTime() - task.startedAt.getTime()) / 1000)
        : 0;
      console.log(`   - ${shortUrl} (${duration}秒)`);
    }
  } else {
    console.log('   ⚠️  没有找到最近成功的任务');
  }
  console.log('');

  // 2. 检查最近失败的任务
  console.log('2. 检查最近失败的任务...');
  const recentFailed = await db.taskQueue.findMany({
    where: { status: 'FAILED' },
    orderBy: { updatedAt: 'desc' },
    take: 3
  });
  
  if (recentFailed.length > 0) {
    console.log(`   ⚠️  找到 ${recentFailed.length} 个最近失败的任务`);
    for (const task of recentFailed) {
      const data = task.data as any;
      const url = data?.url || '未知';
      const shortUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;
      const error = task.error?.substring(0, 100) || '未知错误';
      console.log(`   - ${shortUrl}`);
      console.log(`     错误: ${error}...`);
    }
  } else {
    console.log('   ✅ 没有找到最近失败的任务');
  }
  console.log('');

  // 3. 检查运行中的任务
  console.log('3. 检查运行中的任务...');
  const running = await db.taskQueue.findMany({
    where: { status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
    take: 5
  });
  
  if (running.length > 0) {
    console.log(`   ⚠️  找到 ${running.length} 个运行中的任务`);
    for (const task of running) {
      const data = task.data as any;
      const url = data?.url || '未知';
      const shortUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;
      const runningTime = task.startedAt 
        ? Math.round((Date.now() - task.startedAt.getTime()) / 1000 / 60)
        : 0;
      console.log(`   - ${shortUrl} (已运行 ${runningTime} 分钟)`);
    }
  } else {
    console.log('   ✅ 没有运行中的任务');
  }
  console.log('');

  // 4. 检查播客记录
  console.log('4. 检查最近处理的播客记录...');
  const recentPodcasts = await db.podcast.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  
  if (recentPodcasts.length > 0) {
    console.log(`   ✅ 找到 ${recentPodcasts.length} 个最近处理的播客`);
    for (const podcast of recentPodcasts) {
      const asrLen = podcast.originalTranscript?.length || 0;
      const summaryLen = podcast.summary?.length || 0;
      console.log(`   - ${podcast.title?.substring(0, 40) || '未知'}...`);
      console.log(`     ASR: ${asrLen} 字符, 总结: ${summaryLen} 字符, 状态: ${podcast.status}`);
    }
  } else {
    console.log('   ⚠️  没有找到最近处理的播客');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 检查总结');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const successRate = recentSuccess.length / (recentSuccess.length + recentFailed.length) * 100;
  console.log(`成功率: ${successRate.toFixed(1)}% (${recentSuccess.length}成功 / ${recentFailed.length}失败)`);
  
  if (running.length > 0) {
    console.log(`运行中任务: ${running.length} 个`);
  }
  
  if (recentPodcasts.length > 0) {
    console.log(`最近处理播客: ${recentPodcasts.length} 个`);
  }
}

checkPodcastPipeline().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('检查失败:', error);
  process.exit(1);
});
