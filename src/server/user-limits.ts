import { db } from "@/server/db";
import { UserRole } from "@prisma/client";

export interface UserLimitConfig {
	guest: {
		canUpload: false;
		dailyLimit: 0;
	};
	user: {
		canUpload: true;
		dailyLimit: 5;
	};
	admin: {
		canUpload: true;
		dailyLimit: -1; // 无限制
	};
}

export const USER_LIMITS: UserLimitConfig = {
	guest: {
		canUpload: false,
		dailyLimit: 0
	},
	user: {
		canUpload: true,
		dailyLimit: 5
	},
	admin: {
		canUpload: true,
		dailyLimit: -1
	}
};

// 检查用户是否可以上传
export function canUserUpload(role: UserRole): boolean {
	return USER_LIMITS[role.toLowerCase() as keyof UserLimitConfig].canUpload;
}

// 获取用户每日上传限制
export function getUserDailyLimit(role: UserRole): number {
	return USER_LIMITS[role.toLowerCase() as keyof UserLimitConfig].dailyLimit;
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
	
	return count;
}

// 检查用户是否超过上传限制
export async function checkUserUploadLimit(userId: string, role: UserRole): Promise<{
	allowed: boolean;
	reason?: string;
	currentCount: number;
	limit: number;
}> {
	// 检查是否可以上传
	if (!canUserUpload(role)) {
		return {
			allowed: false,
			reason: "游客用户不能上传音频",
			currentCount: 0,
			limit: 0
		};
	}
	
	// 管理员无限制
	if (role === UserRole.ADMIN) {
		return {
			allowed: true,
			currentCount: 0,
			limit: -1
		};
	}
	
	// 检查普通用户的每日限制
	const currentCount = await getUserTodayUploadCount(userId);
	const limit = getUserDailyLimit(role);
	
	if (currentCount >= limit) {
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
