import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { z } from "zod";
import { requireUser } from "@/server/auth";

export async function GET(req: NextRequest) {
	// 验证用户是否为管理员
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
	const items = await db.user.findMany({ 
		select: { 
			id: true, 
			email: true, 
			username: true, 
			role: true, 
			isBanned: true,
			lastLoginAt: true,
			uploadCount: true,
			createdAt: true 
		} 
	});
	return Response.json({ items });
}

const patchSchema = z.object({
	userId: z.string(),
	action: z.enum(["promote", "demote", "ban", "unban"]),
});

export async function PATCH(req: NextRequest) {
	const json = await req.json().catch(() => null);
	const parsed = patchSchema.safeParse(json);
	if (!parsed.success) return new Response("Bad Request", { status: 400 });
	const { userId, action } = parsed.data;
	
	// 验证用户是否为管理员
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

	// 获取目标用户信息
	const targetUser = await db.user.findUnique({ where: { id: userId } });
	if (!targetUser) return new Response("User not found", { status: 404 });

	// 🛡️ 保护 njumwh@163.com 账号，防止身份变更
	if (targetUser.email === "njumwh@163.com") {
		if (action === "demote") {
			return new Response("Cannot modify super admin account", { status: 403 });
		}
		if (action === "ban") {
			return new Response("Cannot ban super admin account", { status: 403 });
		}
	}

	if (action === "promote") await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
	if (action === "demote") await db.user.update({ where: { id: userId }, data: { role: "USER" } });
	if (action === "ban") await db.user.update({ where: { id: userId }, data: { isBanned: true } });
	if (action === "unban") await db.user.update({ where: { id: userId }, data: { isBanned: false } });
	return Response.json({ ok: true });
}
