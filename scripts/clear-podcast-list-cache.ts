// 清除播客列表缓存
import { cache, cacheKeys } from '../src/utils/cache';

async function clearPodcastListCache() {
  console.log('开始清除播客列表缓存...');
  
  try {
    // 清除所有类型的列表缓存
    const types = ['latest', 'hot', 'all'];
    const pages = [1, 2, 3]; // 清除前几页的缓存
    const limits = [10, 20];
    
    let clearedCount = 0;
    
    for (const type of types) {
      for (const page of pages) {
        for (const limit of limits) {
          const cacheKey = cacheKeys.podcastList(type, undefined, page, limit);
          const deleted = await cache.delete(cacheKey);
          if (deleted) {
            clearedCount++;
            console.log(`✅ 已清除缓存: ${cacheKey}`);
          }
        }
      }
    }
    
    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`缓存清除完成！`);
    console.log(`  已清除: ${clearedCount} 个缓存项`);
    console.log('═══════════════════════════════════════════════════════════');
    
  } catch (error: any) {
    console.error('清除缓存失败:', error.message);
    process.exit(1);
  }
}

clearPodcastListCache()
  .catch((e) => {
    console.error('脚本执行出错:', e);
    process.exit(1);
  });

