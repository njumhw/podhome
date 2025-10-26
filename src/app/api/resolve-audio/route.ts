import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { parseXiaoyuzhouEpisode } from "@/server/parsers/xiaoyuzhou";
import { parseStablePodcast } from "@/server/parsers/stable-podcast-parser";
import { getCachedAudio, setCachedAudio } from "@/server/audio-cache";

const bodySchema = z.object({
	url: z.string().url(),
});

export async function POST(req: NextRequest) {
	const json = await req.json().catch(() => null);
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) return jsonError("Invalid URL", 400);

	const { url } = parsed.data;

    try {
        const meta = await resolvePodcast(url);
        if (!meta.audioUrl) return jsonError("无法获取音频链接", 404);

        // 检查缓存
        const cached = await getCachedAudio(meta.audioUrl);
        if (cached) {
            console.log(`Found cached audio for URL: ${meta.audioUrl}`);
            return Response.json({
                success: true,
                cached: true,
                url: meta.audioUrl,
                format: meta.audioUrl.includes('.m4a') ? 'm4a' : 'unknown',
                title: cached.title || (meta as any).title || null,
                podcastTitle: (meta as any).podcastTitle ?? null,
                author: cached.author || (meta as any).author || (meta as any).podcastTitle || null,
                description: (meta as any).description ?? null,
                publishedAt: cached.publishedAt || (meta as any).publishedAt || null,
                duration: cached.duration || null,
                transcript: cached.transcript || null,
                script: cached.script || null,
                summary: cached.summary || null,
                report: cached.summary || null,
            });
        }

        const audioInfo = {
            url: meta.audioUrl,
            format: meta.audioUrl.includes('.m4a') ? 'm4a' : 'unknown',
            title: (meta as any).title ?? null,
            podcastTitle: (meta as any).podcastTitle ?? null,
            author: (meta as any).author ?? null,
            description: (meta as any).description ?? null,
            publishedAt: (meta as any).publishedAt ?? null,
        };

        return Response.json({
            success: true,
            originalUrl: url,
            audioUrl: meta.audioUrl,
            audioInfo,
            downloadUrl: `/api/proxy-audio?url=${encodeURIComponent(meta.audioUrl)}`
        });

	} catch (error: unknown) {
		console.error("音频解析失败:", error);
		return jsonError(error instanceof Error ? error.message : "音频解析失败", 500);
	}
}

async function resolvePodcast(url: string) {
    try {
        // 优先使用新的稳定解析器
        console.log(`使用稳定解析器解析: ${url}`);
        const stableResult = await parseStablePodcast(url);
        
        // 如果稳定解析器成功获取到音频链接，使用其结果
        if (stableResult.audioUrl && stableResult.confidence > 0.5) {
            console.log(`稳定解析器成功: 可信度=${stableResult.confidence}, 方法=${stableResult.extractionMethod}`);
            return {
                success: true,
                audioUrl: stableResult.audioUrl,
                title: stableResult.title,
                podcastTitle: stableResult.podcastTitle,
                author: stableResult.author,
                description: stableResult.description,
                publishedAt: stableResult.publishedAt,
                confidence: stableResult.confidence,
                extractionMethod: stableResult.extractionMethod,
            };
        }
        
        // 如果稳定解析器失败，回退到原有解析器
        console.log(`稳定解析器失败，回退到原有解析器: ${url}`);
        if (url.includes('xiaoyuzhoufm.com/episode')) {
            return await parseXiaoyuzhouEpisode(url);
        }
        
        // 最后尝试通用解析
        const generic = await resolveGenericAudio(url);
        return { audioUrl: generic } as { audioUrl: string | null };
        
    } catch (error) {
        console.error('稳定解析器出错，回退到原有解析器:', error);
        
        // 出错时回退到原有逻辑
        if (url.includes('xiaoyuzhoufm.com/episode')) {
            return await parseXiaoyuzhouEpisode(url);
        }
        
        const generic = await resolveGenericAudio(url);
        return { audioUrl: generic } as { audioUrl: string | null };
    }
}

// drop older inline XYYZ parser in favor of dedicated module

async function resolveRSSAudio(url: string): Promise<string | null> {
	try {
		const response = await fetch(url);
		const rssText = await response.text();
		
		// 解析RSS中的enclosure标签
		const enclosureMatch = rssText.match(/<enclosure[^>]+url="([^"]+\.(m4a|mp3|wav|aac)[^"]*)"[^>]*>/i);
		if (enclosureMatch?.[1]) {
			return enclosureMatch[1];
		}
		
		return null;
	} catch (error) {
		console.error("RSS音频解析失败:", error);
		return null;
	}
}

async function resolveGenericAudio(url: string): Promise<string | null> {
	// 对于其他类型的链接，尝试直接访问
	try {
		const response = await fetch(url);
		if (response.ok) {
			const contentType = response.headers.get('content-type');
			if (contentType?.includes('audio/')) {
				return url; // 直接返回原始URL
			}
		}
		return null;
	} catch (error) {
		console.error("通用音频解析失败:", error);
		return null;
	}
}

async function getAudioInfo(audioUrl: string) {
	try {
		// 这里可以添加获取音频时长的逻辑
		// 暂时返回基本信息
		return {
			url: audioUrl,
			format: audioUrl.includes('.m4a') ? 'm4a' : 'unknown',
			// duration: await getAudioDuration(audioUrl), // 需要实现
		};
	} catch (error: unknown) {
		return {
			url: audioUrl,
			format: 'unknown',
			error: error instanceof Error ? error.message : String(error)
		};
	}
}