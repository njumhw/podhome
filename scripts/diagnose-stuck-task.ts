import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseStuckTask() {
  const url = 'https://www.xiaoyuzhoufm.com/episode/692cd86fe4244f7e3d3ad135';
  
  console.log('🔍 诊断卡住的任务...\n');
  console.log('URL:', url);
  console.log('');
  
  // 1. 查找任务
  const tasks = await prisma.taskQueue.findMany({
    where: {
      type: 'PODCAST_PROCESSING',
      data: {
        path: ['url'],
        string_contains: '692cd86fe4244f7e3d3ad135'
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  
  if (tasks.length === 0) {
    console.log('❌ 未找到任务');
    await prisma.$disconnect();
    return;
  }
  
  const task = tasks[0];
  console.log('📋 任务信息:');
  console.log('  ID:', task.id);
  console.log('  状态:', task.status);
  console.log('  创建时间:', task.createdAt);
  console.log('  开始时间:', task.startedAt);
  console.log('  完成时间:', task.completedAt);
  
  if (task.startedAt) {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - task.startedAt.getTime()) / 1000 / 60);
    console.log('  已运行时长:', elapsed, '分钟');
  }
  
  console.log('');
  console.log('📊 Metrics:');
  if (task.metrics) {
    console.log(JSON.stringify(task.metrics, null, 2));
  } else {
    console.log('  (无metrics)');
  }
  
  console.log('');
  console.log('📝 Data:');
  if (task.data) {
    console.log(JSON.stringify(task.data, null, 2));
  } else {
    console.log('  (无data)');
  }
  
  console.log('');
  console.log('❌ Error:');
  if (task.error) {
    console.log(task.error);
  } else {
    console.log('  (无错误)');
  }
  
  // 2. 分析可能的问题
  console.log('');
  console.log('🔍 问题分析:');
  
  if (task.metrics?.processingSteps?.asr?.status === 'running') {
    console.log('  ⚠️  任务卡在ASR阶段');
    console.log('  可能原因:');
    console.log('    1. ASR API轮询卡住（网络问题或API响应慢）');
    console.log('    2. 分段ASR中某个分段卡住');
    console.log('    3. ASR任务超时但未正确处理');
    console.log('');
    console.log('  建议操作:');
    console.log('    1. 检查服务器日志中的ASR相关错误');
    console.log('    2. 如果确认卡住，可以手动将任务状态改为FAILED');
    console.log('    3. 检查ASR API的响应状态');
  }
  
  // 3. 检查是否有Podcast记录
  const podcast = await prisma.podcast.findFirst({
    where: {
      sourceUrl: { contains: '692cd86fe4244f7e3d3ad135' }
    }
  });
  
  if (podcast) {
    console.log('');
    console.log('📻 Podcast记录:');
    console.log('  ID:', podcast.id);
    console.log('  状态:', podcast.status);
    console.log('  有ASR:', podcast.originalTranscript ? '是' : '否');
    console.log('  有总结:', podcast.summary ? '是' : '否');
  } else {
    console.log('');
    console.log('📻 Podcast记录: 未找到');
  }
  
  await prisma.$disconnect();
}

diagnoseStuckTask().catch(console.error);

