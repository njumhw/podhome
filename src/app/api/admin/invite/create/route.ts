import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";
import crypto from "crypto";

const schema = z.object({
	count: z.number().int().min(1).max(100).default(1),
	maxUses: z.number().int().min(1).max(100).default(1),
	expiresAt: z.string().datetime().optional(),
});

function genCode(): string {
	return crypto.randomBytes(6).toString("base64url");
}

export async function POST(req: NextRequest) {
	const json = await req.json().catch(() => null);
	const parsed = schema.safeParse(json);
	if (!parsed.success) return new Response("Bad Request", { status: 400 });
	const { count, maxUses, expiresAt } = parsed.data;
	
	// 验证用户是否为管理员
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

	const exp = expiresAt ? new Date(expiresAt) : null;
	const created = await db.$transaction(
		Array.from({ length: count }).map(() =>
			db.inviteCode.create({ data: { code: genCode(), maxUses, expiresAt: exp ?? undefined } })
		)
	);
	return Response.json({ items: created.map((x) => ({ code: x.code, maxUses: x.maxUses, expiresAt: x.expiresAt })) });
}
