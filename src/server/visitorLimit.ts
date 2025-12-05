import { db } from "@/server/db";
import { startOfTodayUTC, endOfTodayUTC } from "@/utils/date";

export const DAILY_VISITOR_LIMIT = 3;

export interface VisitorUsageResult {
	count: number;
	limit: number;
	allowed: boolean;
}

interface RecordVisitorAccessParams {
	podcastId?: string | null;
	audioCacheId?: string | null;
	userId?: string | null;
	userIp?: string | null;
	userAgent?: string | null;
}

function buildDateRange() {
	return {
		gte: startOfTodayUTC(),
		lte: endOfTodayUTC(),
	};
}

export async function getVisitorUsage(ip: string, userAgent: string): Promise<VisitorUsageResult> {
	if (!ip || !userAgent) {
		return { count: 0, limit: DAILY_VISITOR_LIMIT, allowed: true };
	}

	const range = buildDateRange();

	try {
		const count = await db.accessLog.count({
			where: {
				userId: null,
				userIp: ip,
				userAgent,
				createdAt: range,
			},
		});
		return { count, limit: DAILY_VISITOR_LIMIT, allowed: count < DAILY_VISITOR_LIMIT };
	} catch (error) {
		console.error("[VisitorLimit] precise count failed, fallback to IP only:", error);
		const count = await db.accessLog.count({
			where: {
				userId: null,
				userIp: ip,
				createdAt: range,
			},
		});
		return { count, limit: DAILY_VISITOR_LIMIT, allowed: count < DAILY_VISITOR_LIMIT };
	}
}

export async function recordVisitorAccess(params: RecordVisitorAccessParams) {
	const { podcastId, audioCacheId, userId, userIp, userAgent } = params;
	try {
		await db.accessLog.create({
			data: {
				podcastId: podcastId ?? null,
				audioCacheId: audioCacheId ?? null,
				userId: userId ?? null,
				userIp: userIp ?? null,
				userAgent: userAgent ?? null,
			},
		});
	} catch (error) {
		console.error("[VisitorLimit] Failed to create access log:", error);
	}
}

export function buildVisitorInfo(usage: VisitorUsageResult) {
	const used = Math.min(usage.limit, usage.count + 1);
	return {
		total: usage.limit,
		used,
		remaining: Math.max(0, usage.limit - used),
	};
}


