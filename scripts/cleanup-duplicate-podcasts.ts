import { db } from '../src/server/db';

async function cleanupDuplicates() {
  try {
    console.log('开始清理重复的播客记录...\n');
    
    // 查找所有READY状态的播客，按sourceUrl分组
    const allPodcasts = await db.podcast.findMany({
      where: { status: 'READY' },
      select: {
        id: true,
        sourceUrl: true,
        updatedAt: true,
        createdAt: true,
        title: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    // 按sourceUrl分组
    const urlGroups = new Map<string, any[]>();
    allPodcasts.forEach(p => {
      if (p.sourceUrl) {
        const group = urlGroups.get(p.sourceUrl) || [];
        group.push(p);
        urlGroups.set(p.sourceUrl, group);
      }
    });
    
    // 找出重复的组
    const duplicates = Array.from(urlGroups.entries()).filter(([_, items]) => items.length > 1);
    
    console.log(`发现 ${duplicates.length} 个重复的sourceUrl，共 ${allPodcasts.length} 条记录\n`);
    
    let totalDeleted = 0;
    
    for (const [url, items] of duplicates) {
      // 按updatedAt降序排序，保留最新的
      items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      const keep = items[0]; // 保留最新的
      const toDelete = items.slice(1); // 删除其他的
      
      console.log(`\n处理: ${url.substring(0, 80)}...`);
      console.log(`  保留: ${keep.id} (${keep.title.substring(0, 50)}...) - 更新时间: ${keep.updatedAt}`);
      console.log(`  删除: ${toDelete.length} 条重复记录`);
      
      for (const item of toDelete) {
        try {
          await db.podcast.delete({
            where: { id: item.id }
          });
          totalDeleted++;
          console.log(`    ✅ 已删除: ${item.id}`);
        } catch (error: any) {
          console.error(`    ❌ 删除失败: ${item.id} - ${error.message}`);
        }
      }
    }
    
    console.log(`\n清理完成！共删除 ${totalDeleted} 条重复记录`);
    
    // 验证清理结果
    const remaining = await db.podcast.findMany({
      where: { status: 'READY' },
      select: { id: true, sourceUrl: true }
    });
    
    const remainingGroups = new Map<string, number>();
    remaining.forEach(p => {
      if (p.sourceUrl) {
        remainingGroups.set(p.sourceUrl, (remainingGroups.get(p.sourceUrl) || 0) + 1);
      }
    });
    
    const stillDuplicates = Array.from(remainingGroups.entries()).filter(([_, count]) => count > 1);
    if (stillDuplicates.length > 0) {
      console.log(`\n⚠️ 仍有 ${stillDuplicates.length} 个sourceUrl存在重复`);
    } else {
      console.log(`\n✅ 所有重复记录已清理完成`);
    }
    
  } catch (error) {
    console.error('清理失败:', error);
  } finally {
    await db.$disconnect();
  }
}

cleanupDuplicates();




