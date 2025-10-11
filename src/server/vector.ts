import { db } from "@/server/db";

export async function ensureVectorSetup() {
	// Enable extension
	await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
	// Add embedding column if not exists
	await db.$executeRawUnsafe(`
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns 
				WHERE table_name='TranscriptChunk' AND column_name='embedding'
			) THEN
				ALTER TABLE "TranscriptChunk" ADD COLUMN embedding vector(1536);
			END IF;
		END $$;
	`);
	// Create ivfflat index if not exists
	await db.$executeRawUnsafe(`
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_chunk_embedding_ivfflat'
			) THEN
				CREATE INDEX idx_chunk_embedding_ivfflat ON "TranscriptChunk" USING ivfflat (embedding) WITH (lists = 100);
			END IF;
		END $$;
	`);
}

export async function searchSimilarChunks(podcastId: string | null, queryVector: number[], limit = 5) {
	const filter = podcastId ? `WHERE "podcastId" = $1` : "";
	const params: any[] = podcastId ? [podcastId] : [];
	const rows = await db.$queryRawUnsafe<any[]>(
		`SELECT id, "podcastId", "startSec", "endSec", text, (embedding <-> $${params.length + 1}) AS distance
		 FROM "TranscriptChunk"
		 ${filter}
		 ORDER BY embedding <-> $${params.length + 1}
		 LIMIT ${limit};`,
		...params,
		// @ts-ignore
		queryVector
	);
	return rows;
}
