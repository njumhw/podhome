import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/server/db";
import { getEnv } from "@/utils/env";

const SESSION_COOKIE = "pr_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d

type SessionPayload = { userId: string; issuedAt: number };

function sign(data: string, secret: string) {
	return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function encode(payload: SessionPayload, secret: string): string {
	const base = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const sig = sign(base, secret);
	return `${base}.${sig}`;
}

function decode(token: string, secret: string): SessionPayload | null {
	const [base, sig] = token.split(".");
	if (!base || !sig) return null;
	const expected = sign(base, secret);
	if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
	try {
		const payload = JSON.parse(Buffer.from(base, "base64url").toString());
		return payload;
	} catch {
		return null;
	}
}

export async function setSession(userId: string) {
	const secret = getEnv().AUTH_SECRET;
	const token = encode({ userId, issuedAt: Date.now() }, secret);
	const c = await cookies();
	c.set(SESSION_COOKIE, token, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: Math.floor(SESSION_TTL_MS / 1000),
	});
}

export async function clearSession() {
	const c = await cookies();
	c.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSessionUser() {
	const secret = getEnv().AUTH_SECRET;
	const c = await cookies();
	const token = c.get(SESSION_COOKIE)?.value;
	if (!token) return null;
	const payload = decode(token, secret);
	if (!payload) return null;
	const user = await db.user.findUnique({ where: { id: payload.userId } });
	return user;
}

export async function requireUser() {
	const user = await getSessionUser();
	if (!user) throw new Error("UNAUTHORIZED");
	return user;
}

export function requireAdminSecret(secret: string) {
	const env = getEnv();
	return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(env.ADMIN_DASHBOARD_SECRET));
}
