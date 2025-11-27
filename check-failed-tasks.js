const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkFailedTasks() {
  try {
    console.log('检查失败的任务...');
    
    const failedTasks = await prisma.taskQueue.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`找到 ${failedTasks.length} 个失败的任务:`);
    
    for (const task of failedTasks) {
      console.log(`\n任务ID: ${task.id}`);
      console.log(`状态: ${task.status}`);
      console.log(`类型: ${task.type}`);
      console.log(`错误: ${task.error || '无错误信息'}`);
      console.log(`数据: ${JSON.stringify(task.data, null, 2)}`);
      console.log(`创建时间: ${task.createdAt}`);
      console.log(`更新时间: ${task.updatedAt}`);
      console.log('---');
    }
    
  } catch (error) {
    console.error('检查失败任务时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFailedTasks();



