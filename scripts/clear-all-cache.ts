// 清除所有缓存
import { cache } from '../src/utils/cache';
import { multiLevelCache } from '../src/server/multi-level-cache';

async function clearAllCache() {
  console.log('开始清除所有缓存...');
  
  try {
    // 清除内存缓存
    cache.clear();
    console.log('✅ 已清除内存缓存');
    
    // 清除多级缓存
    multiLevelCache.clear();
    console.log('✅ 已清除多级缓存');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('所有缓存已清除完成！');
    console.log('请刷新浏览器页面查看更新后的标题');
    console.log('═══════════════════════════════════════════════════════════');
    
  } catch (error: any) {
    console.error('清除缓存失败:', error.message);
    process.exit(1);
  }
}

clearAllCache()
  .catch((e) => {
    console.error('脚本执行出错:', e);
    process.exit(1);
  });

