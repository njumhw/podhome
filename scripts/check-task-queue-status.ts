import { db } from '../src/server/db';

(async () => {
  // 1. 检查这个特定任务的状态
  const task = await db.taskQueue.findFirst({
    where: { id: 'task_1765206389419_nviqkpoib' },
    select: { 
      id: true, 
      status: true, 
      type: true,
      data: true,
      startedAt: true,
      createdAt: true,
      updatedAt: true,
      error: true,
      result: true
    }
  });
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 检查特定任务状态');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (task) {
    console.log('任务ID:', task.id);
    console.log('状态:', task.status);
    console.log('类型:', task.type);
    console.log('开始时间:', task.startedAt);
    console.log('创建时间:', task.createdAt);
    console.log('更新时间:', task.updatedAt);
    console.log('错误信息:', task.error || '无');
    console.log('结果:', task.result ? '有结果' : '无结果');
    const data = task.data as any;
    console.log('URL:', data?.url);
    console.log('userId:', data?.userId);
  } else {
    console.log('❌ 未找到任务');
  }
  
  // 2. 检查所有运行中的任务
  const runningTasks = await db.taskQueue.findMany({
    where: { status: 'RUNNING' },
    select: { id: true, type: true, startedAt: true, data: true, createdAt: true },
    orderBy: { startedAt: 'desc' },
    take: 10
  });
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 所有运行中的任务');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('运行中的任务数量:', runningTasks.length);
  runningTasks.forEach((t, idx) => {
    const data = t.data as any;
    const runningTime = t.startedAt 
      ? Math.round((Date.now() - t.startedAt.getTime()) / 1000 / 60)
      : 0;
    console.log(`${idx + 1}. ${t.id}`);
    console.log(`   URL: ${data?.url || '未知'}`);
    console.log(`   开始时间: ${t.startedAt}`);
    console.log(`   已运行: ${runningTime} 分钟`);
    console.log(`   创建时间: ${t.createdAt}`);
    console.log('');
  });
  
  // 3. 检查待处理的任务
  const pendingTasks = await db.taskQueue.findMany({
    where: { status: 'PENDING' },
    select: { id: true, type: true, createdAt: true, data: true },
    orderBy: { createdAt: 'asc' },
    take: 10
  });
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 待处理的任务');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('待处理任务数量:', pendingTasks.length);
  pendingTasks.forEach((t, idx) => {
    const data = t.data as any;
    const waitTime = Math.round((Date.now() - t.createdAt.getTime()) / 1000 / 60);
    console.log(`${idx + 1}. ${t.id}`);
    console.log(`   URL: ${data?.url || '未知'}`);
    console.log(`   创建时间: ${t.createdAt}`);
    console.log(`   等待时间: ${waitTime} 分钟`);
    console.log('');
  });
  
  await db.$disconnect();
})();
