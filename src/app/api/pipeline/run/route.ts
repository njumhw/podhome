import { NextRequest } from "next/server";
import { runPipeline } from "@/server/pipeline";
import { requireAdminSecret } from "@/server/auth";

export async function POST(req: NextRequest) {
	const { podcastId, adminSecret } = (await req.json().catch(() => ({}))) as { podcastId?: string; adminSecret?: string };
	if (!podcastId || !adminSecret) return new Response("Bad Request", { status: 400 });
	if (!requireAdminSecret(adminSecret)) return new Response("Forbidden", { status: 403 });

	await runPipeline(podcastId).catch((e) => {
		console.error("pipeline error", e);
	});
	return Response.json({ ok: true });
}
