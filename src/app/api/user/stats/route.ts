import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/utils/http";
import { getUserUsageStats, checkUserUploadLimit } from "@/server/user-limits";
import { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
	const user = await requireUser().catch(() => null);
	if (!user) return jsonError("Unauthorized", 401);

	try {
		// 获取用户使用统计
		const usageStats = await getUserUsageStats(user.id, 7);
		
		// 获取今日上传限制信息
		const limitInfo = await checkUserUploadLimit(user.id, user.role as UserRole);
		
		return Response.json({
			user: {
				id: user.id,
				username: user.username,
				role: user.role,
				uploadCount: user.uploadCount
			},
			limits: {
				canUpload: limitInfo.allowed,
				currentCount: limitInfo.currentCount,
				dailyLimit: limitInfo.limit,
				reason: limitInfo.reason
			},
			usage: usageStats
		});
	} catch (error) {
		console.error("Failed to get user stats:", error);
		return jsonError("Failed to get user stats", 500);
	}
}
