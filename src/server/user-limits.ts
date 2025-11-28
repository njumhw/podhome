import { db } from "@/server/db";
import { UserRole } from "@prisma/client";

// 检查用户是否可以上传
export function canUserUpload(role: UserRole | null): boolean {
	if (!role) return false; // Visitor 不能上传
	
	switch (role) {
		case UserRole.READER:
			return false; // Reader 不能上传
		case UserRole.PODCASTER:
			return true; // Podcaster 可以上传
		case UserRole.PODCASTER_VIP:
			return true; // VIP 可以上传
		case UserRole.ADMIN:
			return true; // 管理员可以上传
		case UserRole.USER:
			return true; // 旧角色，兼容处理
		default:
			return false;
	}
}

// 获取用户每日上传限制
export function getUserDailyLimit(role: UserRole | null): number {
	if (!role) return 0; // Visitor 不能上传
	
	switch (role) {
		case UserRole.READER:
			return 0; // Reader 不能上传
		case UserRole.PODCASTER:
			return 2; // Podcaster 每日 2 次
		case UserRole.PODCASTER_VIP:
			return -1; // VIP 无限制
		case UserRole.ADMIN:
			return -1; // 管理员无限制
		case UserRole.USER:
			return 2; // 旧角色，兼容处理
		default:
			return 0;
	}
}

// 检查用户今日上传次数
export async function getUserTodayUploadCount(userId: string): Promise<number> {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	
	const count = await db.podcast.count({
		where: {
			createdById: userId,
			createdAt: {
				gte: today,
				lt: tomorrow
			}
		}
	});
	
	// 添加调试日志（仅在开发环境）
	if (process.env.NODE_ENV === 'development') {
		console.log(`[getUserTodayUploadCount] User ${userId}: count=${count} (from ${today.toISOString()} to ${tomorrow.toISOString()})`);
	}
	
	return count;
}

// 检查用户是否超过上传限制
export async function checkUserUploadLimit(userId: string, role: UserRole | null): Promise<{
	allowed: boolean;
	reason?: string;
	currentCount: number;
	limit: number;
}> {
	// 检查是否可以上传
	if (!canUserUpload(role)) {
		if (!role) {
			return {
				allowed: false,
				reason: "请登录后上传",
				currentCount: 0,
				limit: 0
			};
		}
		if (role === UserRole.READER) {
			return {
				allowed: false,
				reason: "需要 Podcaster 权限才能上传",
				currentCount: 0,
				limit: 0
			};
		}
		return {
			allowed: false,
			reason: "当前角色不能上传音频",
			currentCount: 0,
			limit: 0
		};
	}
	
	// VIP 和管理员无限制
	if (role === UserRole.PODCASTER_VIP || role === UserRole.ADMIN) {
		return {
			allowed: true,
			currentCount: 0,
			limit: -1
		};
	}
	
	// 检查 Podcaster 的每日限制
	const currentCount = await getUserTodayUploadCount(userId);
	const limit = getUserDailyLimit(role);
	
	if (limit > 0 && currentCount >= limit) {
		return {
			allowed: false,
			reason: `今日上传次数已达上限（${limit}次）`,
			currentCount,
			limit
		};
	}
	
	return {
		allowed: true,
		currentCount,
		limit
	};
}

// 获取用户使用统计
export async function getUserUsageStats(userId: string, days: number = 7) {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	
	const stats = await db.podcast.groupBy({
		by: ['status'],
		where: {
			createdById: userId,
			createdAt: { gte: startDate }
		},
		_count: true
	});
	
	const totalUploads = await db.podcast.count({
		where: {
			createdById: userId,
			createdAt: { gte: startDate }
		}
	});
	
	return {
		totalUploads,
		byStatus: stats.reduce((acc, stat) => {
			acc[stat.status] = stat._count;
			return acc;
		}, {} as Record<string, number>)
	};
}

// 获取所有用户的使用统计（管理员用）
export async function getAllUsersUsageStats(days: number = 7) {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	
	const stats = await db.user.findMany({
		select: {
			id: true,
			username: true,
			email: true,
			role: true,
			uploadCount: true,
			podcasts: {
				where: {
					createdAt: { gte: startDate }
				},
				select: {
					id: true,
					status: true,
					createdAt: true
				}
			}
		}
	});
	
	return stats.map(user => ({
		...user,
		recentUploads: user.podcasts.length,
		recentByStatus: user.podcasts.reduce((acc, podcast) => {
			acc[podcast.status] = (acc[podcast.status] || 0) + 1;
			return acc;
		}, {} as Record<string, number>)
	}));
}
