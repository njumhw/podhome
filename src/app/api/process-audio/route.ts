import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { parseXiaoyuzhouEpisode } from "@/server/parsers/xiaoyuzhou";
import { getCachedAudio, setCachedAudio } from "@/server/audio-cache";
import { recordASRUsage, recordLLMUsage } from "@/server/monitoring";
import { generateScript } from "@/app/api/clean-transcript/route";
import { db } from "@/server/db";
import { getSessionUser } from "@/server/auth";

// 内部处理函数，可以被TaskQueue调用
export async function processAudioInternal(url: string, userId?: string) {
	const startTime = Date.now();
	
	try {
		console.log(`开始内部处理播客链接: ${url}`);
		
		// 计算当前服务的 baseUrl
		const apiBase = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
		
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
			return {
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
					summary: cached.summary || null,
					duration: cached.duration,
					cached: true
				},
				stats: {
					totalTime: Date.now() - startTime,
					fromCache: true
				}
			};
		}
		
		// 缓存元数据
		await setCachedAudio(meta.audioUrl, {
			title: meta.title,
			author: meta.author,
			duration: null,
			originalUrl: url,
			publishedAt: meta.publishedAt
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
		
		// 步骤5: 生成讲稿（使用ABCDE分块策略，确保内容完整性）
		console.log("步骤5: 生成讲稿...");
		let scriptData;
		try {
			// 使用ABCDE分块处理策略
			console.log("使用ABCDE分块处理策略...");
			const scriptResponse = await fetch(`${apiBase}/api/clean-transcript-abcde`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					transcript: asrData.transcript,
					segments: asrData.segments, // 新增：传递ASR片段数组
					language: "zh",
					audioUrl: meta.audioUrl
				}),
				signal: AbortSignal.timeout ? AbortSignal.timeout(20 * 60 * 1000) : undefined // 20分钟超时
			});
			
			if (scriptResponse.ok) {
				const json = await scriptResponse.json();
				if (json?.success) {
					scriptData = {
						success: true,
						script: json.script,
						stats: json.stats
					};
					console.log(`ABCDE讲稿生成完成，耗时: ${json.stats.processingTime}ms，压缩比: ${json.stats.compressionRatio}，分块数: ${json.stats.chunks}`);
					console.log(`说话人角色库: ${json.stats.speakerLibrary.substring(0, 200)}...`);
				}
			}
		} catch (error) {
			console.warn('ABCDE讲稿生成失败，回退到原始处理:', error);
		}
		
		// 如果ABCDE处理失败，回退到原始处理
		if (!scriptData) {
			console.log("回退到原始generateScript函数...");
			scriptData = await generateScript(asrData.transcript, "zh", meta.audioUrl);
			console.log(`原始讲稿生成完成，耗时: ${scriptData.processingTime}ms，压缩比: ${(scriptData.script.length / asrData.transcript.length * 100).toFixed(1)}%`);
		}
		
		// 记录LLM使用情况
		const estimatedTokens = Math.ceil((asrData.transcript.length + scriptData.script.length) / 2);
		await recordLLMUsage(estimatedTokens);
		
		// 更新缓存：保存讲稿和转录文本（已移到步骤5中并行处理）
		
		// 步骤5: 拼接ABCDE处理结果
		console.log("步骤5: 拼接ABCDE处理结果...");
		const optimizedScript = scriptData.script; // ABCDE处理已经完成了优化，直接使用
		
		// 并行更新缓存，不等待完成
		const cacheUpdatePromise = setCachedAudio(meta.audioUrl, {
			title: meta.title,
			author: meta.author,
			duration: asrData.duration,
			transcript: asrData.transcript,
			script: scriptData.script,
			originalUrl: url
		});

		// 步骤6: 生成访谈报告（基于完整访谈记录，一次性生成）
		console.log("步骤6: 生成访谈报告...");
		let reportData = null;
		try {
			// 使用完整访谈记录一次性生成报告
			console.log("基于完整访谈记录生成总结报告...");
			
			// 根据脚本长度动态调整超时时间
			const scriptLength = optimizedScript.length;
			const baseTimeout = 8 * 60 * 1000; // 8分钟基础超时（从5分钟提升）
			const dynamicTimeout = Math.max(baseTimeout, Math.min(scriptLength * 2, 35 * 60 * 1000)); // 最长35分钟（从25分钟提升）
			
			console.log(`脚本长度: ${scriptLength}字符，设置超时: ${Math.round(dynamicTimeout / 1000 / 60)}分钟`);
			
			const reportResponse = await fetch(`${apiBase}/api/generate-report-whole`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					transcript: optimizedScript, // 完整的ABCDE拼接结果
					title: meta.title,
					audioUrl: meta.audioUrl 
				}),
				signal: AbortSignal.timeout ? AbortSignal.timeout(dynamicTimeout) : undefined
			});
			
			if (reportResponse.ok) {
				const json = await reportResponse.json();
				if (json?.success) {
					reportData = json;
					const reportTokens = Math.ceil((optimizedScript.length + (json.summary?.length || 0)) / 2);
					await recordLLMUsage(reportTokens);
					console.log(`完整访谈报告生成完成，报告长度: ${json.summary?.length || 0} 字符`);
				}
			} else {
				console.warn(`报告生成API返回错误: ${reportResponse.status} ${reportResponse.statusText}`);
			}
		} catch (error) {
			console.warn('完整访谈报告生成失败:', error);
			
			// 如果完整报告生成失败，尝试分块生成作为备选方案
			if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
				console.log('检测到超时，尝试分块生成报告...');
				try {
					const fallbackResponse = await fetch(`${apiBase}/api/generate-report`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ 
							transcript: optimizedScript,
							title: meta.title,
							audioUrl: meta.audioUrl 
						}),
						signal: AbortSignal.timeout ? AbortSignal.timeout(15 * 60 * 1000) : undefined // 15分钟超时（从10分钟提升）
					});
					
					if (fallbackResponse.ok) {
						const fallbackJson = await fallbackResponse.json();
						if (fallbackJson?.success) {
							reportData = fallbackJson;
							console.log(`分块报告生成完成，报告长度: ${fallbackJson.summary?.length || 0} 字符`);
						}
					}
				} catch (fallbackError) {
					console.warn('分块报告生成也失败:', fallbackError);
				}
			}
		}
		
		// 最终更新缓存：保存报告数据（等待之前的缓存更新完成）
		await cacheUpdatePromise; // 确保之前的缓存更新完成
		await setCachedAudio(meta.audioUrl, {
			title: meta.title,
			author: meta.author,
			duration: asrData.duration,
			transcript: asrData.transcript,
			script: scriptData.script,
			summary: reportData?.summary || null,
			originalUrl: url,
			publishedAt: meta.publishedAt
		});
		
		// 创建Podcast记录来跟踪用户使用量
		let podcastId = null;
		if (userId) {
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
						summary: reportData?.summary || null,
						processingStartedAt: new Date(startTime),
						processingCompletedAt: new Date(),
						createdById: userId
					}
				});
				podcastId = podcast.id;
				console.log(`Created podcast record: ${podcastId}`);
			} catch (error) {
				console.error('Failed to create podcast record:', error);
			}
		}
		
		const totalTime = Date.now() - startTime;
		console.log(`内部处理完成，总耗时: ${totalTime}ms (${Math.round(totalTime/1000/60)}分钟)`);
		console.log(`处理效率统计:`);
		console.log(`  - 音频时长: ${asrData.duration}秒 (${Math.round(asrData.duration/60)}分钟)`);
		console.log(`  - 转录长度: ${asrData.transcript.length}字符`);
		console.log(`  - 脚本长度: ${optimizedScript.length}字符`);
		console.log(`  - 总结长度: ${reportData?.summary?.length || 0}字符`);
		console.log(`  - 处理速度: ${(asrData.duration / (totalTime/1000)).toFixed(2)}x (音频时长/处理时长)`);
		
		// 获取存储后的数据ID
		const cachedData = await getCachedAudio(meta.audioUrl);
		const audioCacheId = cachedData ? await db.audioCache.findUnique({
			where: { audioUrl: meta.audioUrl },
			select: { id: true }
		}) : null;
		
		return {
			success: true,
			step: "completed",
			progress: 100,
			id: podcastId || audioCacheId?.id || 'temp-id',
			title: meta.title,
			author: meta.author,
			publishedAt: meta.publishedAt,
			audioUrl: meta.audioUrl,
			transcript: asrData.transcript,
			script: optimizedScript,
			summary: reportData?.summary || null,
			duration: asrData.duration,
			totalTime: Date.now() - startTime,
			asrTime: asrProcessingTime,
			estimatedTokens: estimatedTokens + (reportData ? Math.ceil((optimizedScript.length + reportData.summary.length) / 2) : 0)
		};
		
	} catch (error: any) {
		console.error("内部处理失败:", error);
		throw error;
	}
}

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
		
		console.log(`开始同步处理播客链接: ${url}`);
		
		// 调用内部处理函数
		const result = await processAudioInternal(url, user?.id);
		
		// 转换为API响应格式
		return Response.json({
			success: result.success,
			step: result.step,
			progress: result.progress,
			id: result.id,
			data: {
				podcastTitle: result.title,
				title: result.title,
				author: result.author,
				publishedAt: result.publishedAt,
				audioUrl: result.audioUrl,
				transcript: result.transcript,
				script: result.script,
				summary: result.summary,
				duration: result.duration,
				cached: result.cached || false
			},
			stats: {
				totalTime: result.totalTime,
				asrTime: result.asrTime,
				estimatedTokens: result.estimatedTokens,
				fromCache: result.cached || false
			}
		});
		
	} catch (error: any) {
		console.error("同步处理失败:", error);
		return jsonError(error?.message || "处理失败", 500);
	}
}
