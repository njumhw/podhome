import { db } from "@/server/db";

export interface ApiUsageStats {
	asr: {
		count: number;
		lastReset: Date;
		totalDuration: number; // 总处理时长（秒）
	};
	llm: {
		count: number;
		lastReset: Date;
		totalTokens: number;
	};
}

// 内存中的API使用统计
let apiUsage: ApiUsageStats = {
	asr: { count: 0, lastReset: new Date(), totalDuration: 0 },
	llm: { count: 0, lastReset: new Date(), totalTokens: 0 }
};

// 记录ASR API调用
export async function recordASRUsage(duration: number) {
	apiUsage.asr.count++;
	apiUsage.asr.totalDuration += duration;
	
	// 记录到数据库
	try {
		await db.apiUsageLog.create({
			data: {
				apiType: "ASR",
				duration: duration,
				timestamp: new Date()
			}
		});
	} catch (error) {
		console.error("Failed to log ASR usage:", error);
	}
}

// 记录LLM API调用
export async function recordLLMUsage(tokens: number) {
	apiUsage.llm.count++;
	apiUsage.llm.totalTokens += tokens;
	
	// 记录到数据库
	try {
		await db.apiUsageLog.create({
			data: {
				apiType: "LLM",
				tokens: tokens,
				timestamp: new Date()
			}
		});
	} catch (error) {
		console.error("Failed to log LLM usage:", error);
	}
}

// 获取当前API使用统计
export function getApiUsageStats(): ApiUsageStats {
	return { ...apiUsage };
}

// 重置API使用统计（每日重置）
export function resetDailyStats() {
	const now = new Date();
	const lastReset = apiUsage.asr.lastReset;
	
	// 如果是新的一天，重置统计
	if (now.toDateString() !== lastReset.toDateString()) {
		apiUsage = {
			asr: { count: 0, lastReset: now, totalDuration: 0 },
			llm: { count: 0, lastReset: now, totalTokens: 0 }
		};
		console.log("API usage stats reset for new day");
	}
}

// 检查API使用限制
export function checkApiLimits(): { allowed: boolean; reason?: string } {
	const stats = getApiUsageStats();
	
	// ASR限制：每天最多1000次调用
	if (stats.asr.count > 1000) {
		return { allowed: false, reason: "ASR API daily limit exceeded" };
	}
	
	// LLM限制：每天最多10000 tokens
	if (stats.llm.totalTokens > 10000) {
		return { allowed: false, reason: "LLM API daily limit exceeded" };
	}
	
	return { allowed: true };
}

// 获取历史使用统计
export async function getHistoricalStats(days: number = 7) {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	
	const stats = await db.apiUsageLog.groupBy({
		by: ['apiType'],
		where: {
			timestamp: { gte: startDate }
		},
		_sum: {
			duration: true,
			tokens: true
		},
		_count: true
	});
	
	return stats;
}
