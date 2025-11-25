import { db } from '../src/server/db';

async function checkPodcastStatus() {
  try {
    const url = 'https://www.xiaoyuzhoufm.com/episode/64ba0381ead86e7cf1812526';
    
    console.log(`检查播客处理状态: ${url}\n`);
    
    // 1. 检查Podcast表
    const podcasts = await db.podcast.findMany({
      where: {
        OR: [
          { sourceUrl: url },
          { sourceUrl: { contains: url.split('/').pop() || '' } }
        ]
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        processingStartedAt: true,
        processingCompletedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Podcast表中找到 ${podcasts.length} 条记录:`);
    if (podcasts.length > 0) {
      podcasts.forEach((p, idx) => {
        console.log(`\n${idx + 1}. ID: ${p.id}`);
        console.log(`   标题: ${p.title}`);
        console.log(`   状态: ${p.status}`);
        console.log(`   创建时间: ${p.createdAt}`);
        console.log(`   更新时间: ${p.updatedAt}`);
        console.log(`   处理开始: ${p.processingStartedAt || '未开始'}`);
        console.log(`   处理完成: ${p.processingCompletedAt || '未完成'}`);
      });
    } else {
      console.log('   ❌ 未找到记录');
    }
    
    // 2. 检查TaskQueue表
    console.log('\n\n检查任务队列:');
    const tasks = await db.taskQueue.findMany({
      where: {
        data: {
          path: ['url'],
          equals: url
        } as any
      },
      select: {
        id: true,
        type: true,
        status: true,
        data: true,
        result: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        completedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`TaskQueue表中找到 ${tasks.length} 条记录:`);
    if (tasks.length > 0) {
      tasks.forEach((t, idx) => {
        console.log(`\n${idx + 1}. 任务ID: ${t.id}`);
        console.log(`   类型: ${t.type}`);
        console.log(`   状态: ${t.status}`);
        console.log(`   创建时间: ${t.createdAt}`);
        console.log(`   更新时间: ${t.updatedAt}`);
        console.log(`   开始时间: ${t.startedAt || '未开始'}`);
        console.log(`   完成时间: ${t.completedAt || '未完成'}`);
        if (t.error) {
          console.log(`   ❌ 错误: ${t.error}`);
        }
        if (t.data && typeof t.data === 'object') {
          const data = t.data as any;
          console.log(`   数据URL: ${data.url || 'N/A'}`);
        }
      });
    } else {
      console.log('   ❌ 未找到任务记录');
      
      // 尝试更宽泛的搜索
      console.log('\n尝试更宽泛的搜索...');
      const allRecentTasks = await db.taskQueue.findMany({
        where: {
          type: 'PODCAST_PROCESSING',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
          }
        },
        select: {
          id: true,
          status: true,
          data: true,
          error: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      
      console.log(`最近24小时的任务: ${allRecentTasks.length} 个`);
      allRecentTasks.forEach((t, idx) => {
        const data = t.data as any;
        const taskUrl = data?.url || 'N/A';
        console.log(`  ${idx + 1}. ${taskUrl.substring(0, 80)}... - 状态: ${t.status} - ${t.createdAt}`);
        if (t.error) {
          console.log(`     错误: ${t.error.substring(0, 100)}...`);
        }
      });
    }
    
    // 3. 检查AudioCache表
    console.log('\n\n检查AudioCache表:');
    const audioCaches = await db.audioCache.findMany({
      where: {
        originalUrl: url
      },
      select: {
        id: true,
        title: true,
        originalUrl: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });
    
    console.log(`AudioCache表中找到 ${audioCaches.length} 条记录:`);
    if (audioCaches.length > 0) {
      audioCaches.forEach((a, idx) => {
        console.log(`  ${idx + 1}. ID: ${a.id}`);
        console.log(`     标题: ${a.title}`);
        console.log(`     更新时间: ${a.updatedAt}`);
      });
    } else {
      console.log('   ❌ 未找到记录');
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await db.$disconnect();
  }
}

checkPodcastStatus();

