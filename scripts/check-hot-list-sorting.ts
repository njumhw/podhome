// 检查最热列表排序逻辑
import { db } from '../src/server/db';

async function checkHotListSorting() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 检查最热列表排序逻辑');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. 检查点赞数据总数
    const totalLikes = await db.podcastLike.count();
    console.log(`1. 总点赞数: ${totalLikes}`);

    // 2. 检查每个播客的点赞数
    const podcastsWithLikes = await db.podcast.findMany({
      where: { status: 'READY' },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        updatedAt: true,
        _count: { select: { likes: true } }
      },
      take: 20
    });

    console.log(`\n2. 播客点赞数统计（前20个）:`);
    podcastsWithLikes.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.title.substring(0, 50)}...`);
      console.log(`      点赞数: ${p._count.likes}`);
      console.log(`      更新时间: ${p.updatedAt.toLocaleString('zh-CN')}`);
    });

    // 3. 按点赞数排序（模拟API逻辑）
    const sortedByLikes = [...podcastsWithLikes].sort((a, b) => {
      const aLikes = a._count.likes || 0;
      const bLikes = b._count.likes || 0;
      if (aLikes !== bLikes) {
        return bLikes - aLikes; // 点赞数降序
      }
      // 点赞数相同，按更新时间降序
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    console.log(`\n3. 按点赞数排序后的结果（前10个）:`);
    sortedByLikes.slice(0, 10).forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.title.substring(0, 50)}...`);
      console.log(`      点赞数: ${p._count.likes}`);
      console.log(`      更新时间: ${p.updatedAt.toLocaleString('zh-CN')}`);
    });

    // 4. 检查是否有重复的sourceUrl
    const sourceUrlMap = new Map<string, any[]>();
    podcastsWithLikes.forEach(p => {
      const key = p.sourceUrl || p.id;
      if (!sourceUrlMap.has(key)) {
        sourceUrlMap.set(key, []);
      }
      sourceUrlMap.get(key)!.push(p);
    });

    const duplicates = Array.from(sourceUrlMap.entries()).filter(([_, items]) => items.length > 1);
    if (duplicates.length > 0) {
      console.log(`\n4. ⚠️ 发现 ${duplicates.length} 个重复的sourceUrl:`);
      duplicates.slice(0, 5).forEach(([url, items]) => {
        console.log(`   ${url.substring(0, 60)}... (${items.length} 条)`);
        items.forEach(item => {
          console.log(`      - ${item.title.substring(0, 40)}... (点赞: ${item._count.likes})`);
        });
      });
    } else {
      console.log(`\n4. ✅ 没有发现重复的sourceUrl`);
    }

    // 5. 测试API逻辑：获取所有数据并排序
    console.log(`\n5. 测试完整API逻辑:`);
    const allPodcasts = await db.podcast.findMany({
      where: { status: 'READY' },
      select: {
        id: true,
        title: true,
        showAuthor: true,
        publishedAt: true,
        audioUrl: true,
        sourceUrl: true,
        summary: true,
        updatedAt: true,
        topic: { select: { name: true } },
        _count: { select: { likes: true } }
      }
    });

    console.log(`   获取到 ${allPodcasts.length} 条播客数据`);

    // 去重
    const seen = new Map<string, any>();
    for (const item of allPodcasts) {
      const key = item.sourceUrl || item.id;
      const prev = seen.get(key);
      if (!prev) {
        seen.set(key, item);
      } else {
        const prevLikes = prev._count?.likes || 0;
        const currLikes = item._count?.likes || 0;
        if (currLikes > prevLikes || 
            (currLikes === prevLikes && new Date(item.updatedAt).getTime() > new Date(prev.updatedAt).getTime())) {
          seen.set(key, item);
        }
      }
    }

    const uniquePodcasts = Array.from(seen.values());
    console.log(`   去重后: ${uniquePodcasts.length} 条`);

    // 排序
    uniquePodcasts.sort((a, b) => {
      const aLikes = a._count?.likes || 0;
      const bLikes = b._count?.likes || 0;
      if (aLikes !== bLikes) {
        return bLikes - aLikes;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    console.log(`\n   最终排序结果（前10个）:`);
    uniquePodcasts.slice(0, 10).forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.title.substring(0, 50)}...`);
      console.log(`      点赞数: ${p._count?.likes || 0}`);
      console.log(`      作者: ${p.showAuthor || '未知'}`);
      console.log(`      更新时间: ${p.updatedAt.toLocaleString('zh-CN')}`);
    });

    // 6. 检查点赞数据分布
    const likeCounts = uniquePodcasts.map(p => p._count?.likes || 0);
    const maxLikes = Math.max(...likeCounts);
    const minLikes = Math.min(...likeCounts);
    const avgLikes = likeCounts.reduce((a, b) => a + b, 0) / likeCounts.length;
    const zeroLikes = likeCounts.filter(c => c === 0).length;

    console.log(`\n6. 点赞数统计:`);
    console.log(`   最大值: ${maxLikes}`);
    console.log(`   最小值: ${minLikes}`);
    console.log(`   平均值: ${avgLikes.toFixed(2)}`);
    console.log(`   零点赞数: ${zeroLikes} (${((zeroLikes / likeCounts.length) * 100).toFixed(1)}%)`);

    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('检查过程中出错:', error);
  } finally {
    await db.$disconnect();
  }
}

checkHotListSorting();


