// 多级缓存系统
interface CacheEntry<T> {
	value: T;
	timestamp: number;
	ttl: number;
}

class MultiLevelCache {
	private memoryCache = new Map<string, CacheEntry<any>>();
	private readonly memoryCacheSize = 100; // 内存缓存最大条目数
	private readonly defaultTTL = 5 * 60 * 1000; // 5分钟默认TTL

	/**
	 * 获取缓存值
	 */
	async get<T>(key: string): Promise<T | null> {
		// 1. 检查内存缓存
		const memoryEntry = this.memoryCache.get(key);
		if (memoryEntry && this.isValid(memoryEntry)) {
			console.log(`内存缓存命中: ${key}`);
			return memoryEntry.value;
		}

		// 2. 检查数据库缓存（通过现有的audio-cache系统）
		try {
			const dbEntry = await this.getFromDatabase(key);
			if (dbEntry) {
				// 将数据库结果存入内存缓存
				this.setMemoryCache(key, dbEntry, this.defaultTTL);
				console.log(`数据库缓存命中: ${key}`);
				return dbEntry;
			}
		} catch (error) {
			console.warn(`数据库缓存查询失败: ${key}`, error);
		}

		return null;
	}

	/**
	 * 设置缓存值
	 */
	async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<void> {
		// 1. 设置内存缓存
		this.setMemoryCache(key, value, ttl);

		// 2. 设置数据库缓存（异步，不阻塞）
		this.setDatabaseCache(key, value, ttl).catch(error => {
			console.warn(`数据库缓存设置失败: ${key}`, error);
		});
	}

	/**
	 * 删除缓存
	 */
	async delete(key: string): Promise<void> {
		// 删除内存缓存
		this.memoryCache.delete(key);

		// 删除数据库缓存（异步）
		this.deleteDatabaseCache(key).catch(error => {
			console.warn(`数据库缓存删除失败: ${key}`, error);
		});
	}

	/**
	 * 清除所有缓存
	 */
	clear(): void {
		this.memoryCache.clear();
	}

	/**
	 * 获取缓存统计信息
	 */
	getStats(): {
		memoryCacheSize: number;
		memoryCacheKeys: string[];
	} {
		return {
			memoryCacheSize: this.memoryCache.size,
			memoryCacheKeys: Array.from(this.memoryCache.keys())
		};
	}

	// 私有方法
	private isValid(entry: CacheEntry<any>): boolean {
		return Date.now() - entry.timestamp < entry.ttl;
	}

	private setMemoryCache<T>(key: string, value: T, ttl: number): void {
		// 如果内存缓存已满，删除最旧的条目
		if (this.memoryCache.size >= this.memoryCacheSize) {
			const oldestKey = this.memoryCache.keys().next().value;
			if (oldestKey) {
				this.memoryCache.delete(oldestKey);
			}
		}

		this.memoryCache.set(key, {
			value,
			timestamp: Date.now(),
			ttl
		});
	}

	private async getFromDatabase(key: string): Promise<any> {
		// 这里可以集成现有的audio-cache系统
		// 暂时返回null，实际实现时需要根据key的类型查询相应的表
		return null;
	}

	private async setDatabaseCache(key: string, value: any, ttl: number): Promise<void> {
		// 这里可以集成现有的audio-cache系统
		// 实际实现时需要根据key的类型存储到相应的表
	}

	private async deleteDatabaseCache(key: string): Promise<void> {
		// 这里可以集成现有的audio-cache系统
		// 实际实现时需要根据key的类型从相应的表删除
	}
}

// 导出单例实例
export const multiLevelCache = new MultiLevelCache();

// 缓存键生成器
export const cacheKeys = {
	// 音频处理相关
	audioProcessing: (audioUrl: string) => `audio:${audioUrl}`,
	transcript: (audioUrl: string) => `transcript:${audioUrl}`,
	script: (audioUrl: string) => `script:${audioUrl}`,
	summary: (audioUrl: string) => `summary:${audioUrl}`,
	
	// 播客列表相关
	podcastList: (type: string, topic: string | null, page: number, limit: number) => 
		`podcastList:${type}:${topic || 'all'}:${page}:${limit}`,
	
	// 用户相关
	userDailyUsage: (userId: string, date: string) => `userUsage:${userId}:${date}`,
	
	// 主题相关
	topics: () => 'topics:all',
	
	// 提示词相关
	prompt: (name: string) => `prompt:${name}`,
};

// 缓存TTL配置
export const cacheTTL = {
	// 短期缓存（1-5分钟）
	short: 2 * 60 * 1000,
	
	// 中期缓存（5-15分钟）
	medium: 10 * 60 * 1000,
	
	// 长期缓存（15-60分钟）
	long: 30 * 60 * 1000,
	
	// 静态内容缓存（1-24小时）
	static: 60 * 60 * 1000,
};
