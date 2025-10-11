import { getEnv } from "@/utils/env";

export type TranscriptSegment = {
	startSec: number;
	endSec: number;
	text: string;
	speaker?: string;
};

export type TranscriptionResult = {
	segments: TranscriptSegment[];
	language?: string;
	durationSec?: number;
};

/**
 * Transcribe audio from a URL via Alibaba Cloud ASR.
 * Note: This is a placeholder; integrate actual Aliyun SDK/HTTP when wiring up.
 */
export async function transcribeFromUrl(audioUrl: string): Promise<TranscriptionResult> {
	const env = getEnv();
	if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET || !env.ALIYUN_ASR_APP_KEY) {
		throw new Error("Missing Aliyun ASR credentials in env");
	}

	// TODO: Implement real Aliyun ASR HTTP/SDK call with signed request and async polling if needed
	// For now, return a minimal mocked structure to unblock the pipeline wiring.
	return {
		segments: [
			{ startSec: 0, endSec: 5, text: "这是一个占位的转写结果片段。", speaker: "Speaker1" },
		],
		language: "zh",
		durationSec: 5,
	};
}
