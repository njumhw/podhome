const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMetrics() {
  try {
    const url = 'https://www.xiaoyuzhoufm.com/episode/68e86492224325ea70708b2a';
    
    console.log('检查播客处理指标...\n');
    
    // 查找任务记录
    const task = await prisma.taskQueue.findFirst({
      where: {
        data: {
          path: ['url'],
          equals: url
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (task) {
      console.log('任务ID:', task.id);
      console.log('任务状态:', task.status);
      console.log('任务类型:', task.type);
      console.log('创建时间:', task.createdAt);
      console.log('完成时间:', task.completedAt);
      console.log('指标数据:', JSON.stringify(task.metrics, null, 2));
    } else {
      console.log('未找到任务记录');
    }
    
    // 查找播客记录
    const podcast = await prisma.podcast.findFirst({
      where: { sourceUrl: url }
    });
    
    if (podcast) {
      console.log('\n播客记录:');
      console.log('ID:', podcast.id);
      console.log('标题:', podcast.title);
      console.log('状态:', podcast.status);
      console.log('时长:', podcast.duration);
    }
    
    // 查找音频缓存记录
    const audioCache = await prisma.audioCache.findFirst({
      where: {
        OR: [
          { audioUrl: url },
          { originalUrl: url }
        ]
      }
    });
    
    if (audioCache) {
      console.log('\n音频缓存记录:');
      console.log('ID:', audioCache.id);
      console.log('标题:', audioCache.title);
      console.log('时长:', audioCache.duration);
      console.log('ASR段落数:', audioCache.segments?.length || 0);
    }
    
  } catch (error) {
    console.error('检查过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMetrics();

