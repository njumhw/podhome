import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import crypto from "crypto";
import { setSession } from "@/server/auth";
import { jsonError } from "@/utils/http";
import { UserRole } from "@prisma/client";

const bodySchema = z.object({
	email: z.string().email(),
	username: z.string().min(2).max(32),
	password: z.string().min(8),
});

function hashPassword(password: string): string {
	const salt = crypto.randomBytes(16).toString("hex");
	const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
	return `${salt}:${hash}`;
}

export async function POST(req: NextRequest) {
	const json = await req.json().catch(() => null);
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) return jsonError("Bad Request", 400);

	const { email, username, password } = parsed.data;

	// 检查邮箱和用户名是否已存在
	const existingUser = await db.user.findFirst({
		where: {
			OR: [{ email }, { username }],
		},
	});

	if (existingUser) {
		if (existingUser.email === email) {
			return jsonError("Email already exists", 400);
		}
		if (existingUser.username === username) {
			return jsonError("Username already exists", 400);
		}
	}

	// 创建用户，默认角色为 READER
	const user = await db.user.create({
		data: {
			email,
			username,
			passwordHash: hashPassword(password),
			role: UserRole.READER, // 默认角色为 READER
		},
		select: { id: true },
	});

	await setSession(user.id);
	return Response.json({ ok: true });
}
