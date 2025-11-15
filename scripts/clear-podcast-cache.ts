import { cache, cacheKeys } from '../src/utils/cache';

async function clearPodcastCache() {
  try {
    console.log('清除播客列表缓存...\n');
    
    // 清除所有类型的播客列表缓存
    const types = ['latest', 'hot', 'all'];
    const pages = [1, 2, 3]; // 清除前几页
    const limits = [10, 20];
    
    let cleared = 0;
    
    for (const type of types) {
      for (const page of pages) {
        for (const limit of limits) {
          const key = cacheKeys.podcastList(type, undefined, page, limit);
          try {
            await cache.delete(key);
            cleared++;
            console.log(`✅ 已清除: ${key}`);
          } catch (error) {
            console.warn(`⚠️ 清除失败: ${key}`, error);
          }
        }
      }
    }
    
    console.log(`\n共清除 ${cleared} 个缓存项`);
    console.log('✅ 缓存清除完成！');
    
  } catch (error) {
    console.error('清除缓存失败:', error);
  }
}

clearPodcastCache();

