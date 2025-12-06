import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStuckTask() {
  const taskId = 'task_1764987035786_gqd8qi0t6';
  
  console.log('🔧 修复卡住的任务...\n');
  console.log('任务ID:', taskId);
  console.log('');
  
  // 1. 检查任务状态
  const task = await prisma.taskQueue.findUnique({
    where: { id: taskId }
  });
  
  if (!task) {
    console.log('❌ 任务不存在');
    await prisma.$disconnect();
    return;
  }
  
  console.log('当前状态:', task.status);
  console.log('开始时间:', task.startedAt);
  
  if (task.startedAt) {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - task.startedAt.getTime()) / 1000 / 60);
    console.log('已运行时长:', elapsed, '分钟');
  }
  
  console.log('');
  console.log('⚠️  任务卡在ASR阶段，建议操作:');
  console.log('  1. 将任务标记为失败，允许用户重试');
  console.log('  2. 检查服务器日志，查看ASR API的具体错误');
  console.log('  3. 如果是网络问题，重试可能会成功');
  console.log('');
  
  // 询问是否标记为失败
  const shouldMarkFailed = process.argv.includes('--mark-failed');
  
  if (shouldMarkFailed) {
    console.log('🔄 将任务标记为失败...');
    
    await prisma.taskQueue.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: '任务在ASR阶段卡住超过15分钟，已自动终止。可能是ASR API响应慢或网络问题，请重试。'
      }
    });
    
    console.log('✅ 任务已标记为失败');
    console.log('');
    console.log('💡 建议:');
    console.log('  - 用户可以重新提交该播客链接');
    console.log('  - 如果问题持续，检查ASR API服务状态');
    console.log('  - 检查服务器网络连接');
  } else {
    console.log('💡 使用方法:');
    console.log('  npx tsx scripts/fix-stuck-task.ts --mark-failed');
    console.log('');
    console.log('⚠️  或者手动检查:');
    console.log('  1. 查看服务器日志: pm2 logs podroom');
    console.log('  2. 检查ASR API状态');
    console.log('  3. 如果确认卡住，再执行 --mark-failed');
  }
  
  await prisma.$disconnect();
}

fixStuckTask().catch(console.error);

