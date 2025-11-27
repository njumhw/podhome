// 清理播客标题中的 "| 小宇宙 - 听播客，上小宇宙" 后缀
import { db } from '../src/server/db';

async function cleanPodcastTitles() {
  console.log('开始清理播客标题...');
  
  // 查找所有包含 "小宇宙" 后缀的播客
  const podcasts = await db.podcast.findMany({
    where: {
      title: {
        contains: '小宇宙'
      }
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
    }
  });
  
  console.log(`找到 ${podcasts.length} 个需要清理的播客`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  
  for (const [index, podcast] of podcasts.entries()) {
    if (!podcast.title) {
      skippedCount++;
      continue;
    }
    
    // 清理标题：移除 "| 小宇宙 - 听播客，上小宇宙" 或类似的后缀
    let cleanedTitle = podcast.title
      .replace(/\s*\|\s*小宇宙\s*-\s*听播客[，,]\s*上小宇宙\s*/gi, '')
      .replace(/\s*\|\s*小宇宙\s*-\s*听播客[，,]\s*上小宇宙\s*/gi, '')
      .replace(/\s*\|\s*小宇宙\s*/gi, '')
      .replace(/\s*-\s*小宇宙\s*/gi, '')
      .trim();
    
    // 如果标题有变化，更新数据库
    if (cleanedTitle !== podcast.title && cleanedTitle.length > 0) {
      try {
        await db.podcast.update({
          where: { id: podcast.id },
          data: { title: cleanedTitle }
        });
        
        console.log(`[${index + 1}/${podcasts.length}] ✅ 已更新: "${podcast.title.substring(0, 50)}..." -> "${cleanedTitle.substring(0, 50)}..."`);
        updatedCount++;
      } catch (error: any) {
        console.error(`[${index + 1}/${podcasts.length}] ❌ 更新失败: ${podcast.id}`, error.message);
      }
    } else {
      skippedCount++;
      if (cleanedTitle === podcast.title) {
        console.log(`[${index + 1}/${podcasts.length}] 跳过: 标题无需清理`);
      } else {
        console.log(`[${index + 1}/${podcasts.length}] 跳过: 清理后标题为空`);
      }
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('清理完成！');
  console.log(`  总计: ${podcasts.length} 个播客`);
  console.log(`  已更新: ${updatedCount} 个`);
  console.log(`  已跳过: ${skippedCount} 个`);
  console.log('═══════════════════════════════════════════════════════════');
}

cleanPodcastTitles()
  .catch((e) => {
    console.error('脚本执行出错:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });




