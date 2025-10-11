import { db } from "@/server/db";

export interface AudioCacheData {
	title?: string;
	author?: string;
	duration?: number;
	transcript?: string;
	script?: string;
	summary?: string;
	report?: string;
	originalUrl?: string; // 原始页面URL
	publishedAt?: string; // 发布时间 (ISO string)
	metadata?: any;
}

// 检查音频URL是否已缓存
export async function getCachedAudio(audioUrl: string): Promise<AudioCacheData | null> {
	try {
		const cached = await db.audioCache.findUnique({
			where: { audioUrl }
		});
		
		if (!cached) return null;
		
		// 检查缓存是否过期（7天）
		const cacheAge = Date.now() - cached.updatedAt.getTime();
		const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天
		
		if (cacheAge > maxAge) {
			// 缓存过期，删除
			await db.audioCache.delete({ where: { id: cached.id } });
			return null;
		}
		
		return {
			title: cached.title || undefined,
			author: cached.author || undefined,
			duration: cached.duration || undefined,
			transcript: cached.transcript || undefined,
			script: cached.script || undefined,
			summary: cached.summary || undefined,
			report: cached.report || undefined,
			originalUrl: cached.originalUrl || undefined,
			publishedAt: cached.publishedAt || undefined,
			metadata: cached.metadata as any
		};
	} catch (error) {
		console.error("Failed to get cached audio:", error);
		return null;
	}
}

// 缓存音频处理结果
export async function setCachedAudio(audioUrl: string, data: AudioCacheData): Promise<void> {
	try {
		await db.audioCache.upsert({
			where: { audioUrl },
			update: {
				title: data.title,
				author: data.author,
				duration: data.duration,
				transcript: data.transcript,
				script: data.script,
				summary: data.summary,
				report: data.report,
				originalUrl: data.originalUrl,
				publishedAt: data.publishedAt,
				metadata: data.metadata,
				updatedAt: new Date()
			},
			create: {
				audioUrl,
				title: data.title,
				author: data.author,
				duration: data.duration,
				transcript: data.transcript,
				script: data.script,
				summary: data.summary,
				report: data.report,
				originalUrl: data.originalUrl,
				publishedAt: data.publishedAt,
				metadata: data.metadata
			}
		});
	} catch (error) {
		console.error("Failed to cache audio:", error);
	}
}

// 更新缓存中的特定字段
export async function updateCachedAudio(audioUrl: string, updates: Partial<AudioCacheData>): Promise<void> {
	try {
		await db.audioCache.update({
			where: { audioUrl },
			data: {
				...updates,
				updatedAt: new Date()
			}
		});
	} catch (error) {
		console.error("Failed to update cached audio:", error);
	}
}

// 清理过期缓存
export async function cleanupExpiredCache(): Promise<number> {
	try {
		const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7天前
		
		const result = await db.audioCache.deleteMany({
			where: {
				updatedAt: { lt: expiredDate }
			}
		});
		
		console.log(`Cleaned up ${result.count} expired audio cache entries`);
		return result.count;
	} catch (error) {
		console.error("Failed to cleanup expired cache:", error);
		return 0;
	}
}

// 获取缓存统计信息
export async function getCacheStats() {
	try {
		const total = await db.audioCache.count();
		const withTranscript = await db.audioCache.count({
			where: { transcript: { not: null } }
		});
		const withScript = await db.audioCache.count({
			where: { script: { not: null } }
		});
		
		return {
			total,
			withTranscript,
			withScript,
			hitRate: total > 0 ? (withTranscript / total) * 100 : 0
		};
	} catch (error) {
		console.error("Failed to get cache stats:", error);
		return { total: 0, withTranscript: 0, withScript: 0, hitRate: 0 };
	}
}
