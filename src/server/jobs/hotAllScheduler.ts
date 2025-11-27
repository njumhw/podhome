import cron from 'node-cron';
import { refreshHotAllCache } from '@/server/services/hotAllCache';

declare global {
  // eslint-disable-next-line no-var
  var __HOT_ALL_JOB_INIT__: boolean | undefined;
}

if (!global.__HOT_ALL_JOB_INIT__) {
  // 立即尝试预热一次缓存（忽略失败）
  refreshHotAllCache().catch((err) => {
    console.error('[HotAll Scheduler] 初始缓存失败:', err);
  });

  cron.schedule(
    '0 3 * * *',
    async () => {
      console.log('[HotAll Scheduler] 开始 03:00 热榜缓存刷新');
      try {
        await refreshHotAllCache();
        console.log('[HotAll Scheduler] 热榜缓存刷新完成');
      } catch (error) {
        console.error('[HotAll Scheduler] 热榜缓存刷新失败:', error);
      }
    },
    {
      timezone: 'Asia/Shanghai'
    }
  );

  global.__HOT_ALL_JOB_INIT__ = true;
}


