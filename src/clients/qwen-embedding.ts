import { getEnv } from "@/utils/env";

export type EmbeddingResult = {
	vector: number[];
};

export async function embedText(text: string): Promise<EmbeddingResult> {
	const env = getEnv();
	if (!env.QWEN_EMBEDDING_API_KEY) throw new Error("Missing QWEN_EMBEDDING_API_KEY");
	const model = env.QWEN_EMBEDDING_MODEL;

	// TODO: integrate actual Qwen embedding API call
	// Return a fixed-dim fake vector to unblock wiring (1536 dims)
	const dims = 1536;
	const vector = Array.from({ length: dims }, (_, i) => Math.sin(i * 0.001 + text.length));
	console.warn(`[embed] Using placeholder embedding with model ${model}, dims=${dims}`);
	return { vector };
}
