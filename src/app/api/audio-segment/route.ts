import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { spawn, exec } from 'child_process';
import { promises as fsp } from 'fs';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { uploadAndGetPublicUrl, uploadToOssAndGetPublicUrl } from '@/server/storage';
// 使用内置的静态 ffmpeg 二进制，避免本机未安装导致 ENOENT
// 优先读取环境变量 FFMPEG_PATH，其次使用 ffmpeg-static 的内置路径
let ffmpegPath: string | null = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const staticPath = require("ffmpeg-static");
    const candidate = process.env.FFMPEG_PATH || staticPath || null;
    ffmpegPath = candidate && (candidate === 'ffmpeg' || existsSync(candidate)) ? candidate : null;
} catch {
    ffmpegPath = process.env.FFMPEG_PATH || null;
}

// Fallback to system ffmpeg when static binary not present
if (!ffmpegPath) {
    const candidates = [
        process.env.FFMPEG_PATH,
        '/opt/homebrew/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/usr/bin/ffmpeg',
        'ffmpeg',
    ].filter(Boolean) as string[];
    for (const c of candidates) {
        try {
            if (c === 'ffmpeg') { ffmpegPath = c; break; }
            if (existsSync(c)) { ffmpegPath = c; break; }
        } catch {}
    }
}

// 强制使用 Node.js runtime（需要 child_process）
export const runtime = "nodejs";

const querySchema = z.object({
	url: z.string().url(),
	start: z.string().transform(Number),
	end: z.string().transform(Number),
    upload: z.string().optional(), // '1' 表示上传并返回签名URL
    podcastId: z.string().optional(),
});

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const parsed = querySchema.safeParse({
		url: searchParams.get('url'),
		start: searchParams.get('start'),
		end: searchParams.get('end'),
	});

	if (!parsed.success) {
		return jsonError("Invalid parameters", 400);
	}

    const { url, start, end } = parsed.data as any;
    // 读取可选参数（未在上方 safeParse 传入会导致丢失）
    const upload = (new URL(req.url)).searchParams.get('upload') ?? undefined;
    const podcastId = (new URL(req.url)).searchParams.get('podcastId') ?? undefined;

    try {
        // 校验可用的 ffmpeg 可执行文件
        if (!ffmpegPath) {
            return jsonError("FFmpeg binary not found. Please add ffmpeg-static or set FFMPEG_PATH.", 501);
        }

        // 使用FFmpeg进行音频切割（强制通过本服务代理，避免源站防盗链/Referer限制）
		const duration = end - start;
		const origin = (req as any).nextUrl?.origin || `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}`;
		const sourceUrl = `${origin}/api/proxy-audio?url=${encodeURIComponent(url)}`;
		
        // 设置响应头，支持音频流（不设置 Content-Length 以便流式返回）
        const headers = new Headers({
            'Content-Type': 'audio/mp4',
            'Content-Disposition': `attachment; filename="segment_${start}-${end}.m4a"`,
        });

        // 生成临时文件路径
        const tempFile = join(tmpdir(), `segment_${start}-${end}_${Date.now()}.m4a`);

        // 使用FFmpeg切割到临时文件（生成完整 MP4，便于返回 Content-Length）
        // 采用先输入再 seek 的方式，提升稳定性；并开启较低日志级别
        const ffmpegCommand = `"${ffmpegPath}" -hide_banner -loglevel error -i "${sourceUrl}" -ss ${start} -t ${duration} -vn -c:a aac -b:a 128k -movflags +faststart -y "${tempFile}"`;
        
        console.log(`开始切割音频片段: ${start}-${end}秒, 命令: ${ffmpegCommand}`);
        
        await new Promise<void>((resolve, reject) => {
            exec(ffmpegCommand, { timeout: 120000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('FFmpeg exec error:', error);
                    return reject(new Error(`音频切割失败: ${error.message}`));
                }
                
                if (stderr && stderr.includes('error')) {
                    console.error('FFmpeg stderr:', stderr);
                    return reject(new Error(`音频切割失败: ${stderr}`));
                }
                
                resolve();
            });
        });

        // 验证切割后的文件
        const stat = await fsp.stat(tempFile);
        if (stat.size === 0) {
            throw new Error(`切割后的音频文件为空: ${start}-${end}秒`);
        }
        
        console.log(`音频片段切割成功: ${start}-${end}秒, 大小: ${stat.size} bytes`);
        
        const file = await fsp.readFile(tempFile);
        // 清理临时文件（尽力而为）
        fsp.unlink(tempFile).catch(() => {});

        // 若要求上传，返回 JSON（公开直链 URL）
        if (upload === '1') {
            const objectPath = `${podcastId ?? 'unknown'}/${start}-${end}.m4a`;
            // Try OSS first; fallback to Supabase if OSS not configured
            const publicUrl = (await uploadToOssAndGetPublicUrl(objectPath, file, 'audio/mp4'))
                || (await uploadAndGetPublicUrl('segments', objectPath, file, 'audio/mp4'));
            // 尽量删除本地临时文件（已在上方安排）
            if (!publicUrl) {
                return jsonError('Failed to upload segment', 500);
            }
            return Response.json({ url: publicUrl, size: stat.size, start, end });
        }

        headers.set('Content-Length', String(stat.size));
        return new Response(file as BodyInit, { status: 200, headers });

	} catch (error: unknown) {
		console.error("音频切割失败:", error);
		return jsonError(error instanceof Error ? error.message : "音频切割失败", 500);
	}
}

