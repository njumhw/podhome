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

/**
 * 强制刷新summary缓存（在播客处理完成后调用）
 * 异步执行，不阻塞主流程
 */
export async function refreshSummaryCache(): Promise<void> {
	try {
		console.log('[refreshSummaryCache] 开始刷新summary缓存...');
		const summary = await generateSummary();
		cache = {
			summary,
			expiresAt: Date.now() + SUMMARY_TTL_MS,
		};
		console.log(`[refreshSummaryCache] summary缓存刷新成功: ${summary.totalPodcasts} 个播客`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('[refreshSummaryCache] 刷新summary缓存失败:', errorMessage);
		// 刷新失败不影响主流程，只记录错误
	}
}

async function generateSummary(): Promise<PodcastSummary> {
	// 使用数据库聚合查询，大幅提高性能
	// 1. 先统计各状态的播客数量（使用COUNT聚合，不查询数据）
	const [readyCount, processingCount, failedCount] = await Promise.all([
		db.podcast.count({ where: { status: 'READY' } }),
		db.podcast.count({ where: { status: 'PROCESSING' } }),
		db.podcast.count({ where: { status: 'FAILED' } }),
	]);

	// 2. 对于READY状态的播客，需要去重后再统计
	// 去重逻辑：基于 sourceUrl（或 title）去重，保留 summary 最长且 processingCompletedAt 最新的
	// 由于去重逻辑复杂，我们使用数据库窗口函数或子查询来优化
	// 先查询去重后的播客ID列表（只查询必要字段，减少数据传输）
	const readyPodcasts = await db.podcast.findMany({
		where: { status: 'READY' },
		select: {
			id: true,
			sourceUrl: true,
			title: true,
			summary: true,
			processingCompletedAt: true,
			createdAt: true,
		},
	});

	// 应用去重逻辑（这部分逻辑较复杂，暂时保留在应用层）
	// 但只处理必要的字段，不加载duration等大字段
	const pickKey = (p: typeof readyPodcasts[0]) =>
		(p.sourceUrl && p.sourceUrl.trim()) ||
		(p.title && p.title.trim().toLowerCase()) ||
		p.id;

	const shouldReplace = (current: typeof readyPodcasts[0], candidate: typeof readyPodcasts[0]) => {
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

	const dedupMap = new Map<string, typeof readyPodcasts[0]>();
	for (const p of readyPodcasts) {
		const key = pickKey(p);
		const existing = key ? dedupMap.get(key) : null;
		if (!existing || shouldReplace(existing, p)) {
			dedupMap.set(key ?? p.id, p);
		}
	}
	const dedupedReadyIds = Array.from(dedupMap.values()).map(p => p.id);

	// 3. 使用聚合查询计算去重后的总时长和处理时长（只查询去重后的播客）
	const [durationResult, processingDurationResult] = await Promise.all([
		// 总时长（duration字段的SUM）
		db.podcast.aggregate({
			where: {
				id: { in: dedupedReadyIds },
				status: 'READY',
			},
			_sum: {
				duration: true,
			},
		}),
		// 处理时长（需要计算 processingCompletedAt - processingStartedAt 的SUM）
		// 由于Prisma不支持直接计算时间差，我们需要查询这些字段然后计算
		db.podcast.findMany({
			where: {
				id: { in: dedupedReadyIds },
				status: 'READY',
			},
			select: {
				processingStartedAt: true,
				processingCompletedAt: true,
			},
		}),
	]);

	const totalDurationSeconds = durationResult._sum.duration ?? 0;
	
	const totalProcessingDurationMs = processingDurationResult.reduce((acc, p) => {
		if (p.processingStartedAt && p.processingCompletedAt) {
			return acc + (p.processingCompletedAt.getTime() - p.processingStartedAt.getTime());
		}
		return acc;
	}, 0);

	const dedupedReadyCount = dedupedReadyIds.length;

	return {
		totalPodcasts: dedupedReadyCount, // 只统计去重后的 READY 播客
		readyPodcasts: dedupedReadyCount,
		processingPodcasts: processingCount,
		failedPodcasts: failedCount,
		totalProcessingDurationMs,
		totalDurationSeconds,
		totalTasks: dedupedReadyCount, // 使用去重后的数量
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

