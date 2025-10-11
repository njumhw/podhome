import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import crypto from "crypto";
import { setSession } from "@/server/auth";
import { jsonError } from "@/utils/http";

const bodySchema = z.object({
	email: z.string().email(),
	username: z.string().min(2).max(32),
	password: z.string().min(8),
	inviteCode: z.string().min(6),
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

	const { email, username, password, inviteCode } = parsed.data;

	const invite = await db.inviteCode.findUnique({ where: { code: inviteCode } });
	if (!invite) return jsonError("Invalid invite", 400);
	if (invite.expiresAt && invite.expiresAt < new Date()) return jsonError("Invite expired", 400);
	if (invite.uses >= invite.maxUses) return jsonError("Invite exhausted", 400);

	const user = await db.user.create({
		data: {
			email,
			username,
			passwordHash: hashPassword(password),
		},
		select: { id: true },
	});

	await db.inviteCode.update({
		where: { code: inviteCode },
		data: { uses: { increment: 1 }, usedById: user.id },
	});

	await setSession(user.id);
	return Response.json({ ok: true });
}
