import { db } from '../src/server/db';

(async () => {
  const url = 'https://www.xiaoyuzhoufm.com/episode/688cc1cc8e06fe8de7d920cd';
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 检查失败的播客处理状态');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`播客链接: ${url}\n`);

  // 1. 查找任务队列中的任务
  const tasks = await db.taskQueue.findMany({
    where: {
      data: {
        path: ['url'],
        equals: url
      } as any
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (tasks.length === 0) {
    console.log('❌ 未找到该播客的任务记录\n');
  } else {
    console.log(`找到 ${tasks.length} 个相关任务：\n`);
    
    for (const task of tasks) {
      const data = task.data as any;
      const runningTime = task.startedAt 
        ? Math.round((Date.now() - task.startedAt.getTime()) / 1000 / 60)
        : 0;
      
      console.log(`任务ID: ${task.id}`);
      console.log(`  状态: ${task.status}`);
      console.log(`  创建时间: ${task.createdAt.toLocaleString('zh-CN')}`);
      console.log(`  更新时间: ${task.updatedAt.toLocaleString('zh-CN')}`);
      if (task.startedAt) {
        console.log(`  开始时间: ${task.startedAt.toLocaleString('zh-CN')}`);
        console.log(`  已运行: ${runningTime} 分钟`);
      }
      if (task.completedAt) {
        console.log(`  完成时间: ${task.completedAt.toLocaleString('zh-CN')}`);
      }
      if (task.error) {
        console.log(`  错误信息: ${task.error.substring(0, 500)}${task.error.length > 500 ? '...' : ''}`);
      }
      
      // 显示详细的 metrics
      if (task.metrics) {
        console.log(`  指标:`);
        const metrics = task.metrics as any;
        if (metrics.processingSteps) {
          console.log(`    处理步骤:`);
          const steps = metrics.processingSteps;
          if (steps.asr) {
            console.log(`      ASR: ${steps.asr.status}${steps.asr.duration ? ` (${Math.round(steps.asr.duration / 1000)}秒)` : ''}`);
          }
          if (steps.cleaning) {
            console.log(`      清理: ${steps.cleaning.status}${steps.cleaning.duration ? ` (${Math.round(steps.cleaning.duration / 1000)}秒)` : ''}`);
          }
          if (steps.report) {
            console.log(`      报告: ${steps.report.status}${steps.report.duration ? ` (${Math.round(steps.report.duration / 1000)}秒)` : ''}`);
          }
        }
      }
      console.log('');
    }
  }

  // 2. 检查 Podcast 表中的记录
  console.log('2. 检查 Podcast 表中的记录...\n');
  const podcasts = await db.podcast.findMany({
    where: {
      OR: [
        { sourceUrl: url },
        { audioUrl: url }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 3
  });

  if (podcasts.length === 0) {
    console.log('❌ Podcast 表中没有记录（任务可能还在处理中或已失败）\n');
  } else {
    console.log(`找到 ${podcasts.length} 个播客记录：\n`);
    for (const podcast of podcasts) {
      console.log(`播客ID: ${podcast.id}`);
      console.log(`  标题: ${podcast.title || '未知'}`);
      console.log(`  状态: ${podcast.status}`);
      console.log(`  创建时间: ${podcast.createdAt.toLocaleString('zh-CN')}`);
      console.log(`  时长: ${podcast.duration ? `${Math.round(podcast.duration / 60)}分钟` : '未知'}`);
      console.log(`  有总结: ${podcast.summary ? '是' : '否'}`);
      console.log('');
    }
  }

  await db.$disconnect();
})();

