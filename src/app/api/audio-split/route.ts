import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { getConfig, CONFIG_KEYS } from "@/server/config";

const bodySchema = z.object({
	audioUrl: z.string().url(),
	segmentDuration: z.number().min(10).max(180).default(170), // 默认170秒（2分50秒）- 阿里云ASR限制3分钟
});

export async function POST(req: NextRequest) {
	const json = await req.json().catch(() => null);
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) return jsonError("Invalid parameters", 400);

	let { audioUrl, segmentDuration } = parsed.data;

	// 如果启用了自动切割，从配置中读取切割时长
	const enableAutoSegment = (await getConfig(CONFIG_KEYS.AUDIO_AUTO_SEGMENT, "true")) === "true";
	if (enableAutoSegment) {
		const configuredDuration = parseInt(await getConfig(CONFIG_KEYS.AUDIO_SEGMENT_DURATION, "170") || "170");
		if (configuredDuration >= 10 && configuredDuration <= 180) {
			segmentDuration = configuredDuration;
		}
	}

	try {
		// 获取音频时长（模拟）
		const duration = await getAudioDuration(audioUrl);
		
		// 计算切割段数
		const segments = Math.ceil(duration / segmentDuration);
		
		// 生成所有片段信息
		const segmentInfos = [];
		for (let i = 0; i < segments; i++) {
			const startTime = i * segmentDuration;
			const endTime = Math.min((i + 1) * segmentDuration, duration);
			const currentSegmentDuration = endTime - startTime;
			
			// 估算文件大小（假设128kbps码率）
			const estimatedSizeMB = (currentSegmentDuration * 128) / (8 * 1024); // 转换为MB
			
			segmentInfos.push({
				index: i,
				startTime,
				endTime,
				duration: currentSegmentDuration,
				estimatedSizeMB: Math.round(estimatedSizeMB * 100) / 100, // 保留2位小数
				segmentUrl: `/api/audio-segment?url=${encodeURIComponent(audioUrl)}&start=${startTime}&end=${endTime}`,
				downloadUrl: `/api/audio-segment?url=${encodeURIComponent(audioUrl)}&start=${startTime}&end=${endTime}`,
				// 添加阿里云ASR兼容性检查
				asrCompatible: currentSegmentDuration <= 180 && estimatedSizeMB <= 10
			});
		}

		return Response.json({
			success: true,
			originalUrl: audioUrl,
			totalDuration: duration,
			segmentDuration,
			segmentCount: segments,
			segments: segmentInfos
		});

	} catch (error: unknown) {
		console.error("音频切割失败:", error);
		return jsonError(error instanceof Error ? error.message : "音频切割失败", 500);
	}
}

async function getAudioDuration(audioUrl: string): Promise<number> {
	// 使用 ffprobe 获取真实时长，失败时回退到 2640 秒
	try {
		const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
		const ffprobePath = ffmpegPath.endsWith("ffmpeg") ? ffmpegPath.replace(/ffmpeg$/, "ffprobe") : "ffprobe";
		const { exec } = await import("child_process");
		const duration = await new Promise<number>((resolve, reject) => {
			exec(`${ffprobePath} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioUrl}"`, { timeout: 20000 }, (err, stdout) => {
				if (err) return reject(err);
				const val = parseFloat((stdout || "").trim());
				if (Number.isFinite(val) && val > 0) return resolve(Math.floor(val));
				reject(new Error("ffprobe parse failed"));
			});
		});
		return duration;
	} catch (e) {
		console.warn("ffprobe failed, fallback to 2640s:", (e as any)?.message || e);
		return 2640;
	}
}
