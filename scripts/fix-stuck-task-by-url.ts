import { db } from '../src/server/db';

async function fixStuckTaskByUrl(podcastUrl: string, markFailed: boolean = false) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 修复卡住的播客任务');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`播客链接: ${podcastUrl}\n`);

  try {
    // 查找所有相关任务
    const tasks = await db.taskQueue.findMany({
      where: {
        data: {
          path: ['url'],
          equals: podcastUrl
        } as any,
        status: 'RUNNING'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (tasks.length === 0) {
      console.log('❌ 未找到运行中的任务\n');
      return;
    }

    console.log(`找到 ${tasks.length} 个运行中的任务：\n`);

    for (const task of tasks) {
      const runningTime = task.startedAt 
        ? Math.round((Date.now() - task.startedAt.getTime()) / 1000 / 60)
        : 0;

      console.log(`任务ID: ${task.id}`);
      console.log(`  状态: ${task.status}`);
      console.log(`  已运行: ${runningTime} 分钟`);
      
      if (task.metrics) {
        const metrics = task.metrics as any;
        if (metrics.processingSteps) {
          const steps = metrics.processingSteps;
          if (steps.asr?.status === 'running') {
            console.log(`  卡在: ASR转写阶段`);
          } else if (steps.cleaning?.status === 'running') {
            console.log(`  卡在: 文本清理阶段`);
          } else if (steps.report?.status === 'running') {
            console.log(`  卡在: 报告生成阶段`);
          }
        }
      }
      console.log('');

      if (markFailed && runningTime > 15) {
        console.log(`🔄 将任务 ${task.id} 标记为失败...`);
        await db.taskQueue.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            error: `任务运行时间过长（${runningTime}分钟），可能卡在ASR转写阶段，已自动终止。请重试。`,
            completedAt: new Date(),
            updatedAt: new Date()
          }
        });
        console.log(`✅ 任务 ${task.id} 已标记为失败\n`);
      } else if (!markFailed) {
        console.log(`⚠️  任务 ${task.id} 已运行 ${runningTime} 分钟`);
        console.log(`   使用 --mark-failed 选项来终止任务\n`);
      }
    }

    if (!markFailed && tasks.length > 0) {
      console.log('\n💡 提示：要终止这些任务，运行：');
      console.log(`   npx tsx scripts/fix-stuck-task-by-url.ts "${podcastUrl}" --mark-failed`);
    }

  } catch (error: any) {
    console.error('❌ 处理失败:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack.substring(0, 500));
    }
  } finally {
    await db.$disconnect();
  }
}

const args = process.argv.slice(2);
const podcastUrl = args[0];
const markFailed = args.includes('--mark-failed');

if (!podcastUrl) {
  console.error('请提供播客链接作为参数。');
  console.error('用法: npx tsx scripts/fix-stuck-task-by-url.ts <podcast_url> [--mark-failed]');
  process.exit(1);
}

fixStuckTaskByUrl(podcastUrl, markFailed);

