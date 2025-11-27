import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
	// 验证用户是否为管理员
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
	const records = await db.user.findMany({ 
		select: { 
			id: true, 
			email: true, 
			username: true, 
			role: true, 
			isBanned: true,
			lastLoginAt: true,
			uploadCount: true,
			createdAt: true,
			_count: {
				select: { podcasts: true }
			}
		} 
	});
	const items = records.map(({ _count, ...rest }) => ({
		...rest,
		uploadCount: rest.uploadCount && rest.uploadCount > 0
			? rest.uploadCount
			: _count?.podcasts ?? 0,
	}));
	return Response.json({ items });
}

const patchSchema = z.object({
	userId: z.string(),
	action: z.enum(["promote", "demote", "ban", "unban", "set_vip", "remove_vip", "upgrade_to_podcaster"]),
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
		if (action === "demote" || action === "remove_vip") {
			return new Response("Cannot modify super admin account", { status: 403 });
		}
		if (action === "ban") {
			return new Response("Cannot ban super admin account", { status: 403 });
		}
	}

	// 执行操作
	if (action === "promote") {
		await db.user.update({ where: { id: userId }, data: { role: UserRole.ADMIN } });
	} else if (action === "demote") {
		await db.user.update({ where: { id: userId }, data: { role: UserRole.READER } });
	} else if (action === "ban") {
		await db.user.update({ where: { id: userId }, data: { isBanned: true } });
	} else if (action === "unban") {
		await db.user.update({ where: { id: userId }, data: { isBanned: false } });
	} else if (action === "set_vip") {
		// 设置为 VIP（必须是 Podcaster 才能设为 VIP）
		if (targetUser.role !== UserRole.PODCASTER) {
			return new Response("Only Podcaster can be upgraded to VIP", { status: 400 });
		}
		await db.user.update({ where: { id: userId }, data: { role: UserRole.PODCASTER_VIP } });
	} else if (action === "remove_vip") {
		// 移除 VIP，降级为 Podcaster
		if (targetUser.role !== UserRole.PODCASTER_VIP) {
			return new Response("User is not VIP", { status: 400 });
		}
		await db.user.update({ where: { id: userId }, data: { role: UserRole.PODCASTER } });
	} else if (action === "upgrade_to_podcaster") {
		// 将 READER 升级为 PODCASTER
		if (targetUser.role !== UserRole.READER) {
			return new Response("Only READER can be upgraded to PODCASTER", { status: 400 });
		}
		await db.user.update({ where: { id: userId }, data: { role: UserRole.PODCASTER } });
	}

	return Response.json({ ok: true });
}
