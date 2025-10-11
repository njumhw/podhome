import { NextRequest } from "next/server";
import { clearSession } from "@/server/auth";

export async function POST(_req: NextRequest) {
	await clearSession();
	return Response.json({ ok: true });
}
