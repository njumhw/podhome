import { db } from '../src/server/db';

async function checkPodcastOutline() {
  try {
    // 查找最近处理的播客，检查是否有reportOutline
    const podcasts = await db.podcast.findMany({
      where: {
        status: 'READY',
        summary: { not: null }
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        summary: true,
        reportOutline: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 10
    });

    console.log(`找到 ${podcasts.length} 个已处理的播客:\n`);

    for (const podcast of podcasts) {
      const hasOutline = podcast.reportOutline && podcast.reportOutline.trim().length > 0;
      console.log(`播客: ${podcast.title.substring(0, 50)}...`);
      console.log(`  ID: ${podcast.id}`);
      console.log(`  源URL: ${podcast.sourceUrl.substring(0, 80)}...`);
      console.log(`  有总结: ${podcast.summary ? '是' : '否'} (${podcast.summary?.length || 0} 字符)`);
      console.log(`  有大纲: ${hasOutline ? '是' : '否'} ${hasOutline ? `(${podcast.reportOutline?.length || 0} 字符)` : ''}`);
      console.log(`  创建时间: ${podcast.createdAt}`);
      console.log(`  更新时间: ${podcast.updatedAt}`);
      console.log('---');
    }

    // 统计
    const withOutline = podcasts.filter(p => p.reportOutline && p.reportOutline.trim().length > 0).length;
    console.log(`\n统计:`);
    console.log(`  总播客数: ${podcasts.length}`);
    console.log(`  有大纲的: ${withOutline}`);
    console.log(`  没有大纲的: ${podcasts.length - withOutline}`);

  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await db.$disconnect();
  }
}

checkPodcastOutline();




