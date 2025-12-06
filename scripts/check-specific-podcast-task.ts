import { db } from '../src/server/db';

async function checkSpecificPodcastTask(podcastUrl: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 检查特定播客任务状态');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`播客链接: ${podcastUrl}\n`);

  try {
    // 1. 查找任务队列中的任务
    const tasks = await db.taskQueue.findMany({
      where: {
        data: {
          path: ['url'],
          equals: podcastUrl
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
          console.log(`  错误: ${task.error.substring(0, 300)}${task.error.length > 300 ? '...' : ''}`);
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
          if (metrics.asrSegmentsCount !== undefined) {
            console.log(`    ASR分段数: ${metrics.asrSegmentsCount}`);
          }
          if (metrics.chunksCount !== undefined) {
            console.log(`    分块数: ${metrics.chunksCount}`);
          }
        }
        console.log('');
      }
    }

    // 2. 检查 Podcast 表中是否已有记录
    console.log('2. 检查 Podcast 表中的记录...\n');
    const podcasts = await db.podcast.findMany({
      where: {
        OR: [
          { sourceUrl: podcastUrl },
          { audioUrl: podcastUrl }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    if (podcasts.length === 0) {
      console.log('❌ Podcast 表中没有记录（任务可能还在处理中）\n');
    } else {
      console.log(`找到 ${podcasts.length} 个播客记录：\n`);
      for (const podcast of podcasts) {
        console.log(`播客ID: ${podcast.id}`);
        console.log(`  标题: ${podcast.title || '未知'}`);
        console.log(`  状态: ${podcast.status}`);
        console.log(`  创建时间: ${podcast.createdAt.toLocaleString('zh-CN')}`);
        console.log(`  时长: ${podcast.duration ? `${Math.round(podcast.duration / 60)}分钟` : '未知'}`);
        console.log(`  有总结: ${podcast.summary ? '是' : '否'}`);
        if (podcast.summary) {
          console.log(`  总结长度: ${podcast.summary.length} 字符`);
        }
        console.log('');
      }
    }

    // 3. 分析卡住的可能原因
    console.log('3. 问题分析：\n');
    const runningTask = tasks.find(t => t.status === 'RUNNING');
    if (runningTask) {
      const runningTime = runningTask.startedAt 
        ? Math.round((Date.now() - runningTask.startedAt.getTime()) / 1000 / 60)
        : 0;
      
      console.log(`⚠️  发现运行中的任务，已运行 ${runningTime} 分钟`);
      
      const metrics = runningTask.metrics as any;
      if (metrics?.processingSteps) {
        const steps = metrics.processingSteps;
        if (steps.asr?.status === 'running') {
          console.log(`   可能卡在: ASR转写阶段`);
          console.log(`   建议: 检查 ASR API 是否正常响应`);
        } else if (steps.cleaning?.status === 'running') {
          console.log(`   可能卡在: 文本清理阶段`);
        } else if (steps.report?.status === 'running') {
          console.log(`   可能卡在: 报告生成阶段`);
          console.log(`   建议: 检查 LLM API 是否正常响应`);
        } else {
          console.log(`   可能卡在: 未知阶段（请查看服务器日志）`);
        }
      } else {
        console.log(`   可能卡在: 初始阶段（音频下载/元数据解析）`);
      }
      
      if (runningTime > 20) {
        console.log(`\n⚠️  任务运行时间过长（${runningTime}分钟），建议终止并重试`);
        console.log(`   终止命令: npx tsx scripts/fix-stuck-task.ts --task-id ${runningTask.id} --mark-failed`);
      }
    } else {
      console.log('✅ 没有发现运行中的任务');
    }

  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack.substring(0, 500));
    }
  } finally {
    await db.$disconnect();
  }
}

const args = process.argv.slice(2);
const podcastUrl = args[0] || 'https://www.xiaoyuzhoufm.com/episode/671986228956330d702cc6fc';

checkSpecificPodcastTask(podcastUrl);

