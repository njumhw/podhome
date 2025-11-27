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
		return cache.summary;
	}

	const summary = await generateSummary();
	cache = {
		summary,
		expiresAt: now + SUMMARY_TTL_MS,
	};
	return summary;
}

