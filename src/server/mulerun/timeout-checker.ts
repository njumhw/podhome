/**
 * MuleRun 超时检测器
 * 定期检查并处理超时的查询
 */

import { processTimeoutQueries } from './session-manager';

let timeoutCheckerInterval: NodeJS.Timeout | null = null;

/**
 * 启动超时检测器
 * 每 5 分钟检查一次超时的查询
 */
export function startTimeoutChecker() {
  if (timeoutCheckerInterval) {
    console.log('[MuleRun] 超时检测器已在运行');
    return;
  }

  console.log('[MuleRun] 启动超时检测器（每 5 分钟检查一次）');

  // 立即执行一次
  processTimeoutQueries().then(count => {
    if (count > 0) {
      console.log(`[MuleRun] 处理了 ${count} 个超时查询`);
    }
  });

  // 每 5 分钟执行一次
  timeoutCheckerInterval = setInterval(async () => {
    try {
      const count = await processTimeoutQueries();
      if (count > 0) {
        console.log(`[MuleRun] 处理了 ${count} 个超时查询`);
      }
    } catch (error) {
      console.error('[MuleRun] 超时检测失败:', error);
    }
  }, 5 * 60 * 1000); // 5 分钟
}

/**
 * 停止超时检测器
 */
export function stopTimeoutChecker() {
  if (timeoutCheckerInterval) {
    clearInterval(timeoutCheckerInterval);
    timeoutCheckerInterval = null;
    console.log('[MuleRun] 超时检测器已停止');
  }
}

