import { db } from '../src/server/db';
import { taskQueue } from '../src/server/task-queue';

async function checkTaskQueueStatus() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 任务队列状态检查');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // 1. 检查任务队列初始化状态
    console.log('1. 检查任务队列初始化状态...');
    await taskQueue.initialize();
    console.log('✅ 任务队列已初始化\n');
    
    // 2. 检查最近的任务
    console.log('2. 检查最近的任务（最近10个）...');
    const recentTasks = await db.taskQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log(`找到 ${recentTasks.length} 个任务：\n`);
    
    for (const task of recentTasks) {
      const data = task.data as any;
      const url = data?.url || '未知';
      const shortUrl = url.length > 60 ? url.substring(0, 60) + '...' : url;
      
      console.log(`任务ID: ${task.id}`);
      console.log(`  状态: ${task.status}`);
      console.log(`  URL: ${shortUrl}`);
      console.log(`  创建时间: ${task.createdAt}`);
      console.log(`  更新时间: ${task.updatedAt}`);
      if (task.error) {
        console.log(`  错误: ${task.error.substring(0, 200)}${task.error.length > 200 ? '...' : ''}`);
      }
      if (task.startedAt) {
        console.log(`  开始时间: ${task.startedAt}`);
      }
      if (task.completedAt) {
        console.log(`  完成时间: ${task.completedAt}`);
      }
      console.log('');
    }
    
    // 3. 检查特定URL的任务
    const targetUrl = 'https://www.xiaoyuzhoufm.com/episode/68d9d7c79f1dd30c6713e571';
    console.log(`3. 检查特定URL的任务: ${targetUrl}\n`);
    
    const targetTasks = await db.taskQueue.findMany({
      where: {
        data: {
          path: ['url'],
          equals: targetUrl
        } as any
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    if (targetTasks.length === 0) {
      console.log('❌ 未找到该URL的任务\n');
    } else {
      console.log(`找到 ${targetTasks.length} 个相关任务：\n`);
      for (const task of targetTasks) {
        console.log(`任务ID: ${task.id}`);
        console.log(`  状态: ${task.status}`);
        console.log(`  创建时间: ${task.createdAt}`);
        console.log(`  更新时间: ${task.updatedAt}`);
        if (task.error) {
          console.log(`  错误: ${task.error}`);
        }
        if (task.metrics) {
          console.log(`  指标:`, JSON.stringify(task.metrics, null, 2));
        }
        console.log('');
      }
    }
    
    // 4. 检查环境变量
    console.log('4. 检查ASR相关环境变量...');
    console.log(`  QWEN_ASR_MODEL: ${process.env.QWEN_ASR_MODEL || '未设置（将使用默认值 fun-asr）'}`);
    console.log(`  QWEN_API_KEY: ${process.env.QWEN_API_KEY ? '已设置' : '未设置'}`);
    console.log(`  ALIYUN_OSS_BUCKET: ${process.env.ALIYUN_OSS_BUCKET || '未设置'}`);
    console.log(`  ALIYUN_OSS_REGION: ${process.env.ALIYUN_OSS_REGION || '未设置'}`);
    
  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack.substring(0, 500));
    }
  } finally {
    await db.$disconnect();
  }
}

checkTaskQueueStatus();

