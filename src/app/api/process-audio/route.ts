import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { parseXiaoyuzhouEpisode } from "@/server/parsers/xiaoyuzhou";
import { getCachedAudio, setCachedAudio } from "@/server/audio-cache";
import { recordASRUsage, recordLLMUsage } from "@/server/monitoring";
import { generateScript } from "@/app/api/clean-transcript/route";
import { db } from "@/server/db";
import { getSessionUser } from "@/server/auth";

const bodySchema = z.object({
	url: z.string().url(),
});

export async function POST(req: NextRequest) {
	const startTime = Date.now();
	
	try {
		const body = await req.json().catch(() => ({}));
		const parsed = bodySchema.safeParse(body);
		
		if (!parsed.success) {
			return jsonError("Invalid URL", 400);
		}
		
		const { url } = parsed.data;
		
		// 检查用户认证和额度
		let user = null;
		
		try {
			user = await getSessionUser();
		} catch (error) {
			console.error('Auth check failed:', error);
		}
		
		// 检查用户额度
		const today = new Date().toISOString().split('T')[0];
		let dailyUsage = 0;
		
		if (user) {
			// 查询用户今日使用量（通过Podcast表）
			const usage = await db.podcast.count({
				where: {
					createdById: user.id,
					createdAt: {
						gte: new Date(today + 'T00:00:00.000Z'),
						lt: new Date(today + 'T23:59:59.999Z')
					}
				}
			});
			dailyUsage = usage;
		}
		
		// 确定用户额度
		let quota = 0;
		if (user) {
			if (user.role === 'ADMIN') {
				quota = Infinity; // 管理员无限制
			} else if (user.role === 'USER') {
				quota = 5; // 普通用户每天5个
			} else {
				quota = 0; // 其他角色无额度
			}
		} else {
			quota = 0; // 游客无额度
		}
		
		// 检查是否超出额度
		if (dailyUsage >= quota) {
			if (!user) {
				return jsonError("请先登录后再处理播客", 401);
			} else if (user.role === 'USER') {
				return jsonError("今日处理额度已用完，请明天再试", 429);
			} else {
				return jsonError("无权限处理播客", 403);
			}
		}
		
		console.log(`开始一键处理播客链接: ${url}`);
		
		// 计算当前服务的 baseUrl（优先使用请求 origin，其次 env，最后默认 3000）
		const baseUrl = (() => {
			try { return new URL(req.url).origin; } catch { return undefined; }
		})();
		const apiBase = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
		
		// 步骤1: 解析播客链接
		console.log("步骤1: 解析播客链接...");
		const resolveResponse = await fetch(`${apiBase}/api/resolve-audio`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url })
		});
		
		if (!resolveResponse.ok) {
			throw new Error("播客链接解析失败");
		}
		
        const resolveData = await resolveResponse.json();
        const resolvedUrl = resolveData.url || resolveData.audioUrl;
        if (!resolveData.success || !resolvedUrl) {
            throw new Error("无法获取音频链接");
        }
        
        const meta = {
            audioUrl: resolvedUrl,
            title: resolveData.title ?? resolveData.audioInfo?.title,
            author: resolveData.author ?? resolveData.audioInfo?.author,
            podcastTitle: resolveData.podcastTitle ?? resolveData.audioInfo?.podcastTitle,
            description: resolveData.description ?? resolveData.audioInfo?.description,
            publishedAt: resolveData.publishedAt ?? resolveData.audioInfo?.publishedAt
        };
		
		// 检查缓存
		const cached = await getCachedAudio(meta.audioUrl);
		if (cached && cached.transcript && cached.script) {
			console.log("发现完整缓存，直接返回结果");
			return Response.json({
				success: true,
				step: "completed",
				progress: 100,
				data: {
					podcastTitle: meta.podcastTitle,
					title: cached.title || meta.title,
					author: cached.author || meta.author,
					publishedAt: meta.publishedAt,
					audioUrl: meta.audioUrl,
					transcript: cached.transcript,
					script: cached.script,
					report: cached.report || null,
					duration: cached.duration,
					cached: true
				},
				stats: {
					totalTime: Date.now() - startTime,
					fromCache: true
				}
			});
		}
		
		// 缓存元数据
		await setCachedAudio(meta.audioUrl, {
			title: meta.title,
			author: meta.author,
			duration: null, // 稍后更新
			originalUrl: url, // 保存原始页面URL
			publishedAt: meta.publishedAt // 保存发布时间
		});
		
		// 步骤2: 获取音频信息
		console.log("步骤2: 获取音频信息...");
		
		// 步骤3: 音频切分
		console.log("步骤3: 音频切分...");
		const splitResponse = await fetch(`${apiBase}/api/audio-split`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ audioUrl: meta.audioUrl, segmentDuration: 170 })
		});
		
		if (!splitResponse.ok) {
			throw new Error("音频切分失败");
		}
		
		const splitData = await splitResponse.json();
		if (!splitData.success) {
			throw new Error("音频切分失败: " + splitData.error);
		}
		
		// 步骤4: ASR转写
		console.log("步骤4: ASR转写...");
        const asrResponse = await fetch(`${apiBase}/api/asr`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ audioUrl: meta.audioUrl })
		});
		
        if (!asrResponse.ok) {
            const errText = await asrResponse.text().catch(()=>"");
            throw new Error(`ASR转写失败: ${errText || asrResponse.status}`);
        }
        
        const asrData = await asrResponse.json().catch(async () => ({ success: false, error: await asrResponse.text().catch(()=>"解析失败") }));
		if (!asrData.success) {
			throw new Error("ASR转写失败: " + asrData.error);
		}
		
		// 记录ASR使用情况
		const asrProcessingTime = Math.round((Date.now() - startTime) / 1000);
		await recordASRUsage(asrProcessingTime);
		
        // 步骤5: 生成讲稿（改为直接函数调用，避免内部HTTP超时）
        console.log("步骤5: 生成讲稿...");
        const scriptData = await generateScript(asrData.transcript, "zh", meta.audioUrl);
		
		// 记录LLM使用情况
		const estimatedTokens = Math.ceil((asrData.transcript.length + scriptData.script.length) / 2);
		await recordLLMUsage(estimatedTokens);
		
		// 更新缓存：保存讲稿和转录文本
		await setCachedAudio(meta.audioUrl, {
			title: meta.title,
			author: meta.author,
			duration: asrData.duration,
			transcript: asrData.transcript,
			script: scriptData.script,
			originalUrl: url
		});
		
        // 步骤6: 生成访谈报告（保留HTTP或改为直接函数取决于实现，此处保留HTTP但带更长容错）
        console.log("步骤6: 生成访谈报告...");
        let reportData = null;
        try {
            const reportResponse = await fetch(`${apiBase}/api/generate-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    transcript: scriptData.script,
                    title: meta.title,
                    audioUrl: meta.audioUrl 
                }),
                signal: AbortSignal.timeout ? AbortSignal.timeout(30 * 60 * 1000) : undefined
            });
            if (reportResponse.ok) {
                const json = await reportResponse.json();
                if (json?.success) {
                    reportData = json;
                    const reportTokens = Math.ceil((scriptData.script.length + (json.report?.length || 0)) / 2);
                    await recordLLMUsage(reportTokens);
                }
            }
        } catch {}
		
		// 最终更新缓存：保存报告数据
		await setCachedAudio(meta.audioUrl, {
			title: meta.title,
			author: meta.author,
			duration: asrData.duration,
			transcript: asrData.transcript,
			script: scriptData.script,
			summary: meta.description || meta.summary || null,
			report: reportData?.report || null,
			originalUrl: url,
			publishedAt: meta.publishedAt
		});
		
		// 创建Podcast记录来跟踪用户使用量
		let podcastId = null;
		if (user) {
			try {
				const podcast = await db.podcast.create({
					data: {
						title: meta.title || '未命名播客',
						sourceUrl: url,
						audioUrl: meta.audioUrl,
						description: meta.description || meta.summary || null,
						publishedAt: meta.publishedAt ? new Date(meta.publishedAt) : null,
						duration: asrData.duration,
						status: 'COMPLETED',
						originalTranscript: asrData.transcript,
						transcript: scriptData.script,
						summary: reportData?.report || null,
						processingStartedAt: new Date(startTime),
						processingCompletedAt: new Date(),
						createdById: user.id
					}
				});
				podcastId = podcast.id;
				console.log(`Created podcast record: ${podcastId}`);
			} catch (error) {
				console.error('Failed to create podcast record:', error);
			}
		}
		
		console.log(`一键处理完成，总耗时: ${Date.now() - startTime}ms`);
		
		// 获取存储后的数据ID
		const cachedData = await getCachedAudio(meta.audioUrl);
		const audioCacheId = cachedData ? await db.audioCache.findUnique({
			where: { audioUrl: meta.audioUrl },
			select: { id: true }
		}) : null;
		
		return Response.json({
			success: true,
			step: "completed",
			progress: 100,
			id: podcastId || audioCacheId?.id || 'temp-id',
			data: {
				podcastTitle: meta.podcastTitle,
				title: meta.title,
				author: meta.author,
				publishedAt: meta.publishedAt,
				audioUrl: meta.audioUrl,
				transcript: asrData.transcript,
				script: scriptData.script,
				report: reportData?.report || null,
				duration: asrData.duration,
				cached: false
			},
			stats: {
				totalTime: Date.now() - startTime,
				asrTime: asrProcessingTime,
				estimatedTokens: estimatedTokens + (reportData ? Math.ceil((scriptData.script.length + reportData.report.length) / 2) : 0),
				fromCache: false
			}
		});
		
	} catch (error: any) {
		console.error("一键处理失败:", error);
		return jsonError(error?.message || "处理失败", 500);
	}
}
