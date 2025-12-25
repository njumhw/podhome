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
			sourceUrl: true,
			title: true,
			summary: true,
			createdAt: true,
			processingStartedAt: true,
			processingCompletedAt: true,
		},
	});

	const ready = podcasts.filter((p) => p.status === "READY");
	const processing = podcasts.filter((p) => p.status === "PROCESSING");
	const failed = podcasts.filter((p) => p.status === "FAILED");

	// 去重逻辑：基于 sourceUrl（或 title）去重，保留 summary 最长且 processingCompletedAt 最新的
	const pickKey = (p: typeof podcasts[0]) =>
		(p.sourceUrl && p.sourceUrl.trim()) ||
		(p.title && p.title.trim().toLowerCase()) ||
		p.id;

	const shouldReplace = (current: typeof podcasts[0], candidate: typeof podcasts[0]) => {
		const currentLen = current.summary?.length ?? 0;
		const candidateLen = candidate.summary?.length ?? 0;
		if (candidateLen !== currentLen) return candidateLen > currentLen;
		const currentTime = new Date(
			current.processingCompletedAt ?? current.createdAt ?? 0
		).getTime();
		const candidateTime = new Date(
			candidate.processingCompletedAt ?? candidate.createdAt ?? 0
		).getTime();
		return candidateTime > currentTime;
	};

	// 对 READY 状态的播客进行去重
	const dedupMap = new Map<string, typeof podcasts[0]>();
	for (const p of ready) {
		const key = pickKey(p);
		const existing = key ? dedupMap.get(key) : null;
		if (!existing || shouldReplace(existing, p)) {
			dedupMap.set(key ?? p.id, p);
		}
	}
	const dedupedReady = Array.from(dedupMap.values());

	const totalProcessingDurationMs = dedupedReady.reduce((acc, p) => {
		if (p.processingStartedAt && p.processingCompletedAt) {
			return (
				acc +
				(p.processingCompletedAt.getTime() -
					p.processingStartedAt.getTime())
			);
		}
		return acc;
	}, 0);

	const totalDurationSeconds = dedupedReady.reduce(
		(acc, p) => acc + (p.duration ?? 0),
		0
	);

	return {
		totalPodcasts: dedupedReady.length, // 只统计去重后的 READY 播客
		readyPodcasts: dedupedReady.length,
		processingPodcasts: processing.length,
		failedPodcasts: failed.length,
		totalProcessingDurationMs,
		totalDurationSeconds,
		totalTasks: dedupedReady.length, // 使用去重后的数量
		refreshedAt: new Date().toISOString(),
	};
}

export async function getPodcastSummary(force = false): Promise<PodcastSummary> {
	const now = Date.now();
	
	// force=true时，强制刷新，不使用缓存
	if (force) {
		console.log('[getPodcastSummary] force=true，强制刷新，忽略缓存');
	} else if (cache && cache.expiresAt > now) {
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
		
		// 如果有缓存（即使过期），返回缓存数据，避免显示0
		if (cache) {
			console.log('[getPodcastSummary] 生成失败，返回缓存数据（即使可能过期）');
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

