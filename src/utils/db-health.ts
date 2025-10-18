import { db } from '@/server/db';

export interface HealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  error?: string;
  responseTime?: number;
}

class DatabaseHealthChecker {
  private lastStatus: HealthStatus | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;

  // 执行健康检查
  async checkHealth(): Promise<HealthStatus> {
    if (this.isChecking) {
      return this.lastStatus || { isHealthy: false, lastCheck: new Date(), error: '检查进行中' };
    }

    this.isChecking = true;
    const startTime = Date.now();

    try {
      // 执行简单的查询测试连接
      await db.$queryRaw`SELECT 1`;
      
      const responseTime = Date.now() - startTime;
      const status: HealthStatus = {
        isHealthy: true,
        lastCheck: new Date(),
        responseTime
      };

      this.lastStatus = status;
      return status;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const status: HealthStatus = {
        isHealthy: false,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : String(error),
        responseTime
      };

      this.lastStatus = status;
      console.error('数据库健康检查失败:', error);
      return status;

    } finally {
      this.isChecking = false;
    }
  }

  // 获取最后状态
  getLastStatus(): HealthStatus | null {
    return this.lastStatus;
  }

  // 启动定期检查
  startPeriodicCheck(intervalMs: number = 30000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.checkHealth();
    }, intervalMs);

    console.log(`数据库健康检查已启动，间隔: ${intervalMs}ms`);
  }

  // 停止定期检查
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('数据库健康检查已停止');
    }
  }

  // 等待连接恢复
  async waitForConnection(timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkHealth();
      if (status.isHealthy) {
        return true;
      }
      
      // 等待5秒后重试
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    return false;
  }

  // 强制重新连接
  async forceReconnect(): Promise<boolean> {
    try {
      console.log('尝试强制重新连接数据库...');
      
      // 断开现有连接
      await db.$disconnect();
      
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 重新连接
      await db.$connect();
      
      // 验证连接
      const status = await this.checkHealth();
      return status.isHealthy;
      
    } catch (error) {
      console.error('强制重新连接失败:', error);
      return false;
    }
  }
}

// 导出单例
export const dbHealth = new DatabaseHealthChecker();

// 在应用启动时启动健康检查
if (typeof window === 'undefined') {
  setTimeout(() => {
    dbHealth.startPeriodicCheck(30000); // 每30秒检查一次
  }, 5000); // 延迟5秒启动
}

