// 增强的内存缓存实现，集成多级缓存
import { multiLevelCache, cacheKeys as mlCacheKeys, cacheTTL } from '@/server/multi-level-cache';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class EnhancedMemoryCache {
  private cache = new Map<string, CacheItem<any>>();

  async set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): Promise<void> {
    // 设置本地内存缓存
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });

    // 同时设置多级缓存
    await multiLevelCache.set(key, data, ttlMs);
  }

  async get<T>(key: string): Promise<T | null> {
    // 1. 检查本地内存缓存
    const item = this.cache.get(key);
    if (item && this.isValid(item)) {
      return item.data;
    }

    // 2. 检查多级缓存
    const mlResult = await multiLevelCache.get<T>(key);
    if (mlResult) {
      // 将多级缓存结果存入本地缓存
      this.cache.set(key, {
        data: mlResult,
        timestamp: Date.now(),
        ttl: cacheTTL.medium
      });
      return mlResult;
    }

    return null;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    await multiLevelCache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    multiLevelCache.clear();
  }

  // 清理过期项
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private isValid(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }

  // 获取缓存统计信息
  getStats() {
    return {
      localCache: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys())
      },
      multiLevelCache: multiLevelCache.getStats()
    };
  }
}

// 全局缓存实例
export const cache = new EnhancedMemoryCache();

// 定期清理过期缓存
setInterval(() => {
  cache.cleanup();
}, 5 * 60 * 1000); // 每5分钟清理一次

// 缓存键生成器（兼容原有接口，同时使用多级缓存键）
export const cacheKeys = {
  podcastList: (type: string, topic?: string, page?: number, limit?: number) => 
    mlCacheKeys.podcastList(type, topic || null, page || 1, limit || 20),
  topics: () => mlCacheKeys.topics(),
  user: (userId: string) => `user_${userId}`,
  podcast: (id: string) => `podcast_${id}`,
  search: (query: string) => `search_${query}`,
  
  // 新增的缓存键
  audioProcessing: (audioUrl: string) => mlCacheKeys.audioProcessing(audioUrl),
  transcript: (audioUrl: string) => mlCacheKeys.transcript(audioUrl),
  script: (audioUrl: string) => mlCacheKeys.script(audioUrl),
  summary: (audioUrl: string) => mlCacheKeys.summary(audioUrl),
  userDailyUsage: (userId: string, date: string) => mlCacheKeys.userDailyUsage(userId, date),
  prompt: (name: string) => mlCacheKeys.prompt(name),
};
