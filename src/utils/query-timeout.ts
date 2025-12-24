/**
 * 数据库查询超时包装器
 * 防止慢查询阻塞整个应用
 */

export async function withQueryTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 10000, // 默认10秒超时
  errorMessage: string = '查询超时'
): Promise<T> {
  return Promise.race([
    queryFn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${errorMessage} (超过 ${timeoutMs}ms)`));
      }, timeoutMs);
    })
  ]);
}

