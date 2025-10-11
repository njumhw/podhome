import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { embedText } from "@/clients/qwen-embedding";
import { ensureVectorSetup, searchSimilarChunks } from "@/server/vector";
import { db } from "@/server/db";
import { answerQA } from "@/clients/qwen-text";
import { jsonError } from "@/utils/http";

const bodySchema = z.object({
	q: z.string().min(1),
	limit: z.number().int().min(1).max(8).optional(),
});

function formatTime(sec: number) {
	const m = Math.floor(sec / 60)
		.toString()
		.padStart(2, "0");
	const s = Math.floor(sec % 60)
		.toString()
		.padStart(2, "0");
	return `${m}:${s}`;
}

export async function POST(req: NextRequest) {
	const user = await requireUser().catch(() => null);
	if (!user) return jsonError("Unauthorized", 401);

	const json = await req.json().catch(() => null);
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) return jsonError("Bad Request", 400);
	const { q, limit = 5 } = parsed.data;

	await ensureVectorSetup();
	const { vector } = await embedText(q);
	const chunks = await searchSimilarChunks(null, vector, limit);

	if (!chunks || chunks.length === 0) {
		return Response.json({ answer: "逐字稿中未提及", citations: [] });
	}

	const podcastIds = Array.from(new Set(chunks.map((c: any) => c.podcastId)));
	const podcasts = await db.podcast.findMany({
		where: { id: { in: podcastIds } },
		select: { id: true, title: true },
	});
	const idToPodcast = new Map(podcasts.map((p) => [p.id, p] as const));

	const context = chunks
		.map((c: any) => {
			const p = idToPodcast.get(c.podcastId);
			return `【${p?.title ?? c.podcastId} ${formatTime(c.startSec)}-${formatTime(c.endSec)}】\n${c.text}`;
		})
		.join("\n\n");

	const { answer } = await answerQA({ question: q, context });

	const citations = chunks.map((c: any) => {
		const p = idToPodcast.get(c.podcastId);
		return {
			podcastId: c.podcastId,
			podcastTitle: p?.title ?? "",
			start: c.startSec,
			end: c.endSec,
			time: `${formatTime(c.startSec)}-${formatTime(c.endSec)}`,
			chunkId: c.id,
		};
	});

	return Response.json({ answer, citations });
}
