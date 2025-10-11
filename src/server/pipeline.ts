import { db } from "@/server/db";
import { transcribeFromUrl } from "@/clients/aliyun-asr";
import { cleanTranscript, summarize, identifySpeakers } from "@/clients/qwen-text";
import { embedText } from "@/clients/qwen-embedding";
import { ensureVectorSetup } from "@/server/vector";

async function withTask<T>(podcastId: string, type: "TRANSCRIBE"|"CLEAN"|"IDENTIFY"|"SUMMARIZE"|"CHUNK"|"EMBED", fn: () => Promise<T>): Promise<T> {
	const started = Date.now();
	const log = await db.taskLog.create({ data: { podcastId, type, status: "RUNNING" } });
	try {
		const result = await fn();
		await db.taskLog.update({ where: { id: log.id }, data: { status: "SUCCESS", durationMs: Date.now() - started } });
		return result;
	} catch (err: any) {
		await db.taskLog.update({ where: { id: log.id }, data: { status: "FAILED", durationMs: Date.now() - started, error: String(err?.message ?? err) } });
		throw err;
	}
}

function naiveChunk(text: string): { startSec: number; endSec: number; text: string }[] {
	const sentences = text.split(/(?<=[。！？.!?])\s*/);
	const chunks: string[] = [];
	let buf = "";
	for (const s of sentences) {
		if ((buf + s).length > 800) {
			chunks.push(buf);
			buf = s;
		} else {
			buf += (buf ? " " : "") + s;
		}
	}
	if (buf) chunks.push(buf);
	return chunks.map((t, i) => ({ startSec: i * 30, endSec: i * 30 + 30, text: t }));
}

export async function runPipeline(podcastId: string) {
	const p = await db.podcast.findUnique({ where: { id: podcastId } });
	if (!p) throw new Error("Podcast not found");
	if (!p.sourceUrl) throw new Error("Missing sourceUrl");

	const audioUrl = p.audioUrl ?? p.sourceUrl;

	const asr = await withTask(podcastId, "TRANSCRIBE", async () => transcribeFromUrl(audioUrl));
	const rawTranscript = asr.segments.map(s => `${s.speaker ?? "Speaker"}:${s.text}`).join("\n");
	
	// 保存原始转写结果
	await db.podcast.update({ 
		where: { id: podcastId }, 
		data: { originalTranscript: rawTranscript } 
	});

	const cleaned = await withTask(podcastId, "CLEAN", async () => {
		const { cleaned } = await cleanTranscript({ raw: rawTranscript });
		return cleaned;
	});

	const withSpeakers = await withTask(podcastId, "IDENTIFY", async () => {
		return await identifySpeakers(cleaned);
	});

	const summary = await withTask(podcastId, "SUMMARIZE", async () => {
		const { summary } = await summarize({ text: withSpeakers });
		return summary;
	});

	await db.podcast.update({ 
		where: { id: podcastId }, 
		data: { 
			transcript: withSpeakers, 
			summary, 
			status: "READY",
			processingCompletedAt: new Date()
		} 
	});

	const chunks = await withTask(podcastId, "CHUNK", async () => naiveChunk(withSpeakers));
	await db.transcriptChunk.deleteMany({ where: { podcastId } });
	await db.$transaction(
		chunks.map(c => db.transcriptChunk.create({ data: { podcastId, startSec: c.startSec, endSec: c.endSec, text: c.text } }))
	);

	await ensureVectorSetup();
	await withTask(podcastId, "EMBED", async () => {
		const rows = await db.transcriptChunk.findMany({ where: { podcastId }, select: { id: true, text: true } });
		for (const r of rows) {
			const { vector } = await embedText(r.text);
			await db.$executeRawUnsafe(`UPDATE "TranscriptChunk" SET embedding = $1 WHERE id = $2`, vector as any, r.id);
		}
	});
}
