import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";

export async function GET(req: NextRequest) {
	// 验证用户是否为管理员
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

	const codes = await db.inviteCode.findMany({
		select: {
			id: true,
			code: true,
			maxUses: true,
			uses: true,
			expiresAt: true,
			createdAt: true,
			usedBy: {
				select: {
					id: true,
					username: true,
					email: true,
					role: true,
					createdAt: true,
				}
			}
		},
		orderBy: { createdAt: "desc" },
	});

	return Response.json({ codes });
}
