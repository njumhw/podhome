import { db } from '../src/server/db';

async function checkDbData() {
  try {
    console.log('检查数据库中的播客数据...\n');
    
    // 检查所有READY状态的播客
    const allPodcasts = await db.podcast.findMany({
      where: { status: 'READY' },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        updatedAt: true,
        createdAt: true,
        publishedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });
    
    console.log(`找到 ${allPodcasts.length} 个已发布的播客:\n`);
    allPodcasts.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.title.substring(0, 50)}...`);
      console.log(`   ID: ${p.id}`);
      console.log(`   源URL: ${p.sourceUrl.substring(0, 80)}...`);
      console.log(`   更新时间: ${p.updatedAt}`);
      console.log(`   创建时间: ${p.createdAt}`);
      console.log('');
    });
    
    // 检查是否有重复的sourceUrl
    const sourceUrlMap = new Map<string, number>();
    allPodcasts.forEach(p => {
      const count = sourceUrlMap.get(p.sourceUrl) || 0;
      sourceUrlMap.set(p.sourceUrl, count + 1);
    });
    
    const duplicates = Array.from(sourceUrlMap.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log(`\n⚠️ 发现 ${duplicates.length} 个重复的sourceUrl:`);
      duplicates.forEach(([url, count]) => {
        console.log(`  ${url.substring(0, 80)}... (${count} 次)`);
      });
    } else {
      console.log('\n✅ 没有发现重复的sourceUrl');
    }
    
    // 测试最新列表查询
    console.log('\n测试最新列表查询:');
    const latest = await db.podcast.findMany({
      where: { status: 'READY' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });
    console.log(`返回 ${latest.length} 个播客`);
    latest.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.title.substring(0, 50)}... (${p.updatedAt})`);
    });
    
    // 测试最热列表查询（检查排序语法）
    console.log('\n测试最热列表查询:');
    try {
      const hot = await db.podcast.findMany({
        where: { status: 'READY' },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { likes: true } }
        },
        orderBy: [
          { updatedAt: 'desc' } // 先使用简单的排序测试
        ],
        take: 10
      });
      console.log(`返回 ${hot.length} 个播客`);
      hot.forEach((p, idx) => {
        console.log(`  ${idx + 1}. ${p.title.substring(0, 50)}... (点赞: ${p._count.likes}, 更新: ${p.updatedAt})`);
      });
    } catch (error: any) {
      console.error('最热列表查询失败:', error.message);
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await db.$disconnect();
  }
}

checkDbData();




