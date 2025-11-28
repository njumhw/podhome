import { db } from "@/server/db";

export interface PodcastSummary {
	totalPodcasts: number;
	readyPodcasts: number;
	processingPodcasts: number;
	failedPodcasts: number;
	totalProcessingDurationMs: number;
	totalDurationSeconds: number;
	totalTasks: number;
	refreshedAt: string;
}

const SUMMARY_TTL_MS = 60 * 60 * 1000; // 1 hour

let cache: { summary: PodcastSummary; expiresAt: number } | null = null;

async function generateSummary(): Promise<PodcastSummary> {
	const podcasts = await db.podcast.findMany({
		select: {
			id: true,
			status: true,
			duration: true,
			createdAt: true,
			processingStartedAt: true,
			processingCompletedAt: true,
		},
	});

	const ready = podcasts.filter((p) => p.status === "READY");
	const processing = podcasts.filter((p) => p.status === "PROCESSING");
	const failed = podcasts.filter((p) => p.status === "FAILED");

	const totalProcessingDurationMs = ready.reduce((acc, p) => {
		if (p.processingStartedAt && p.processingCompletedAt) {
			return (
				acc +
				(p.processingCompletedAt.getTime() -
					p.processingStartedAt.getTime())
			);
		}
		return acc;
	}, 0);

	const totalDurationSeconds = ready.reduce(
		(acc, p) => acc + (p.duration ?? 0),
		0
	);

	return {
		totalPodcasts: podcasts.length,
		readyPodcasts: ready.length,
		processingPodcasts: processing.length,
		failedPodcasts: failed.length,
		totalProcessingDurationMs,
		totalDurationSeconds,
		totalTasks: podcasts.length,
		refreshedAt: new Date().toISOString(),
	};
}

export async function getPodcastSummary(force = false): Promise<PodcastSummary> {
	const now = Date.now();
	if (!force && cache && cache.expiresAt > now) {
		console.log('[getPodcastSummary] 使用缓存数据');
		return cache.summary;
	}

	try {
		console.log('[getPodcastSummary] 开始生成摘要...');
		const summary = await generateSummary();
		cache = {
			summary,
			expiresAt: now + SUMMARY_TTL_MS,
		};
		console.log(`[getPodcastSummary] 摘要生成成功: ${summary.totalPodcasts} 个播客`);
		return summary;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('[getPodcastSummary] 生成摘要失败:', errorMessage);
		
		// 如果有缓存，返回缓存数据
		if (cache) {
			console.log('[getPodcastSummary] 返回过期缓存数据');
			return cache.summary;
		}
		
		// 如果没有缓存，返回默认值
		console.log('[getPodcastSummary] 返回默认值');
		return {
			totalPodcasts: 0,
			readyPodcasts: 0,
			processingPodcasts: 0,
			failedPodcasts: 0,
			totalProcessingDurationMs: 0,
			totalDurationSeconds: 0,
			totalTasks: 0,
			refreshedAt: new Date().toISOString(),
		};
	}
}

