import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import crypto from "crypto";
import { setSession } from "@/server/auth";

const bodySchema = z.object({
	identifier: z.string().min(2), // email or username
	password: z.string().min(8),
});

function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(":");
	const calc = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
	return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calc));
}

export async function POST(req: NextRequest) {
	try {
		console.log("🔍 登录 API 被调用");
		
		const json = await req.json().catch(() => null);
		console.log("请求数据:", json);
		
		const parsed = bodySchema.safeParse(json);
		if (!parsed.success) {
			console.log("❌ 请求数据验证失败:", parsed.error);
			return Response.json({ error: "请求数据格式错误，请检查输入" }, { status: 400 });
		}

		const { identifier, password } = parsed.data;
		console.log("验证用户:", identifier);
		
		const user = await db.user.findFirst({
			where: {
				OR: [{ email: identifier }, { username: identifier }],
			},
		});
		
		if (!user) {
			console.log("❌ 用户不存在");
			return Response.json({ error: "该账户不存在，请检查邮箱或用户名" }, { status: 401 });
		}
		
		if (user.isBanned) {
			console.log("❌ 用户被封禁");
			return Response.json({ error: "账户已被封禁，请联系管理员" }, { status: 403 });
		}
		
		if (!verifyPassword(password, user.passwordHash)) {
			console.log("❌ 密码错误");
			return Response.json({ error: "密码错误，请重试" }, { status: 401 });
		}

		console.log("✅ 用户验证成功，设置会话");
		
		// 更新最后登录时间
		await db.user.update({ 
			where: { id: user.id }, 
			data: { lastLoginAt: new Date() } 
		});

		await setSession(user.id);
		console.log("✅ 会话设置成功");
		
		return Response.json({ ok: true });
	} catch (error) {
		console.error("❌ 登录 API 错误:", error);
		return Response.json({ 
			error: "服务器内部错误，请稍后重试", 
			details: String(error) 
		}, { status: 500 });
	}
}