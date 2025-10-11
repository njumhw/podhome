import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/utils/http";
import { getAllUsersUsageStats } from "@/server/user-limits";

export async function GET(req: NextRequest) {
	const user = await requireUser().catch(() => null);
	if (!user) return jsonError("Unauthorized", 401);
	
	// 只有管理员可以访问
	if (user.role !== "ADMIN") {
		return jsonError("Forbidden", 403);
	}

	try {
		const days = parseInt(new URL(req.url).searchParams.get("days") || "7");
		const stats = await getAllUsersUsageStats(days);
		
		return Response.json({
			period: `${days} days`,
			users: stats
		});
	} catch (error) {
		console.error("Failed to get all users stats:", error);
		return jsonError("Failed to get user stats", 500);
	}
}
