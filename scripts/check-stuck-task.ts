// 检查并处理卡住的任务
import { db } from '../src/server/db';

const url = 'https://www.youtube.com/watch?v=McTi0DdKybY';

async function checkAndFixStuckTask() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 检查卡住的任务');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 查找该 URL 的任务
    const tasks = await db.taskQueue.findMany({
      where: {
        data: {
          path: ['url'],
          equals: url
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1
    });

    if (tasks.length === 0) {
      console.log('❌ 未找到任务记录');
      return;
    }

    const task = tasks[0];
    console.log(`任务ID: ${task.id}`);
    console.log(`状态: ${task.status}`);
    console.log(`创建时间: ${task.createdAt.toLocaleString('zh-CN')}`);
    console.log(`开始时间: ${task.startedAt?.toLocaleString('zh-CN') || '未开始'}`);
    
    if (task.startedAt && !task.completedAt) {
      const runningTime = Math.round((Date.now() - task.startedAt.getTime()) / 1000);
      const runningMinutes = Math.round(runningTime / 60);
      console.log(`⏱️  已运行: ${runningTime} 秒 (${runningMinutes} 分钟)`);
      
      // 如果运行超过15分钟，建议终止
      if (runningTime > 15 * 60) {
        console.log('\n⚠️  任务运行时间过长，建议终止');
        console.log('执行以下操作终止任务:');
        console.log(`await db.taskQueue.update({`);
        console.log(`  where: { id: '${task.id}' },`);
        console.log(`  data: {`);
        console.log(`    status: 'FAILED',`);
        console.log(`    error: '任务运行时间过长（${runningMinutes}分钟），已自动终止',`);
        console.log(`    completedAt: new Date()`);
        console.log(`  }`);
        console.log(`});`);
        
        // 询问是否终止
        console.log('\n是否要终止这个任务？(y/n)');
        // 这里可以添加交互式输入，但为了自动化，我们直接终止
        console.log('自动终止任务...');
        
        await db.taskQueue.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            error: `任务运行时间过长（${runningMinutes}分钟），可能卡在解析 YouTube 视频元数据步骤，已自动终止`,
            completedAt: new Date()
          }
        });
        
        console.log('✅ 任务已终止');
      }
    }

    // 检查所有长时间运行的任务
    console.log('\n\n📋 检查所有长时间运行的任务');
    console.log('───────────────────────────────────────────────────────────');
    
    const longRunningTasks = await db.taskQueue.findMany({
      where: {
        status: 'RUNNING',
        startedAt: {
          not: null,
          lt: new Date(Date.now() - 15 * 60 * 1000) // 运行超过15分钟
        }
      },
      orderBy: {
        startedAt: 'asc'
      }
    });

    if (longRunningTasks.length > 0) {
      console.log(`发现 ${longRunningTasks.length} 个长时间运行的任务:`);
      for (const t of longRunningTasks) {
        const data = t.data as any;
        const taskUrl = data?.url || 'N/A';
        const runningTime = t.startedAt ? Math.round((Date.now() - t.startedAt.getTime()) / 1000) : 0;
        const runningMinutes = Math.round(runningTime / 60);
        console.log(`\n  - 任务ID: ${t.id}`);
        console.log(`    URL: ${taskUrl.substring(0, 60)}...`);
        console.log(`    已运行: ${runningMinutes} 分钟`);
        
        // 自动终止超过20分钟的任务
        if (runningTime > 20 * 60) {
          console.log(`    ⚠️  自动终止（超过20分钟）`);
          await db.taskQueue.update({
            where: { id: t.id },
            data: {
              status: 'FAILED',
              error: `任务运行时间过长（${runningMinutes}分钟），已自动终止`,
              completedAt: new Date()
            }
          });
        }
      }
    } else {
      console.log('✅ 没有发现长时间运行的任务');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('检查过程中出错:', error);
  } finally {
    await db.$disconnect();
  }
}

checkAndFixStuckTask();



