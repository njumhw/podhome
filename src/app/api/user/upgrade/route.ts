import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/utils/http";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const bodySchema = z.object({
	inviteCode: z.string().min(6),
});

export async function POST(req: NextRequest) {
	const user = await requireUser();
	
	// 检查用户当前角色
	if (user.role === UserRole.PODCASTER || user.role === UserRole.PODCASTER_VIP || user.role === UserRole.ADMIN) {
		return jsonError("您已经是 Podcaster 或更高权限，无需升级", 400);
	}

	if (user.role !== UserRole.READER) {
		return jsonError("只有 Reader 可以升级为 Podcaster", 400);
	}

	const json = await req.json().catch(() => null);
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) return jsonError("Bad Request", 400);

	const { inviteCode } = parsed.data;

	// 验证邀请码
	const invite = await db.inviteCode.findUnique({ where: { code: inviteCode } });
	if (!invite) {
		return jsonError("邀请码无效", 400);
	}

	// 检查邀请码是否过期
	if (invite.expiresAt && invite.expiresAt < new Date()) {
		return jsonError("邀请码已过期", 400);
	}

	// 检查邀请码是否已用完
	if (invite.uses >= invite.maxUses) {
		return jsonError("邀请码已用完", 400);
	}

	// 检查邀请码目标角色
	if (invite.targetRole !== UserRole.PODCASTER) {
		return jsonError("此邀请码不是用于 Podcaster 升级", 400);
	}

	// 检查用户是否已经使用过邀请码升级（可选，防止重复升级）
	// 这里我们允许用户重复使用，只要邀请码还有剩余次数

	// 升级用户角色
	await db.user.update({
		where: { id: user.id },
		data: { role: UserRole.PODCASTER },
	});

	// 更新邀请码使用次数
	await db.inviteCode.update({
		where: { code: inviteCode },
		data: {
			uses: { increment: 1 },
			usedById: user.id,
		},
	});

	return Response.json({
		ok: true,
		message: "升级成功！您现在可以上传播客了（每日 2 次）",
	});
}

