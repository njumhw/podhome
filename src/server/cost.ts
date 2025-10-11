import { db } from "@/server/db";

// 从 ApiUsage 表获取真实成本数据
export async function estimateCostSummary() {
	// 获取 API 使用统计
	const usage = await db.apiUsage.findMany({
		select: {
			service: true,
			endpoint: true,
			tokens: true,
			duration: true,
			cost: true,
			createdAt: true,
		},
		orderBy: { createdAt: 'desc' },
	});

	// 按服务分组统计
	const summary: Record<string, { 
		count: number; 
		totalCost: number; 
		totalTokens: number; 
		avgDuration: number;
		lastUsed: Date | null;
	}> = {};

	for (const u of usage) {
		if (!summary[u.service]) {
			summary[u.service] = { 
				count: 0, 
				totalCost: 0, 
				totalTokens: 0, 
				avgDuration: 0,
				lastUsed: null
			};
		}
		
		summary[u.service].count += 1;
		summary[u.service].totalCost += Number(u.cost || 0);
		summary[u.service].totalTokens += u.tokens || 0;
		summary[u.service].avgDuration += u.duration || 0;
		summary[u.service].lastUsed = u.createdAt;
	}

	// 计算平均值
	for (const service in summary) {
		if (summary[service].count > 0) {
			summary[service].avgDuration = summary[service].avgDuration / summary[service].count;
		}
	}

	const totalUSD = Object.values(summary).reduce((a, b) => a + b.totalCost, 0);
	
	return { 
		summary, 
		totalUSD,
		recentUsage: usage.slice(0, 10) // 最近10条记录
	};
}

// 记录 API 使用
export async function logApiUsage(data: {
	service: string;
	endpoint: string;
	tokens?: number;
	duration?: number;
	cost?: number;
	metadata?: any;
}) {
	return await db.apiUsage.create({
		data: {
			service: data.service,
			endpoint: data.endpoint,
			tokens: data.tokens,
			duration: data.duration,
			cost: data.cost,
			metadata: data.metadata,
		},
	});
}
