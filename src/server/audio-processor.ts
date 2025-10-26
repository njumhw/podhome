import { z } from "zod";
import { jsonError } from "@/utils/http";
import { parseXiaoyuzhouEpisode } from "@/server/parsers/xiaoyuzhou";
import { getCachedAudio, setCachedAudio } from "@/server/audio-cache";
import { recordASRUsage, recordLLMUsage } from "@/server/monitoring";
import { db } from "@/server/db";
import { withRetry } from "@/utils/error-handler";

// 更新任务指标的函数
async function updateTaskMetrics(taskId: string, metrics: any) {
  try {
    await db.taskQueue.update({
      where: { id: taskId },
      data: {
        metrics: {
          ...metrics
        },
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('更新任务指标失败:', error);
  }
}

// 内部处理函数，可以被TaskQueue调用
export async function processAudioInternal(url: string, userId?: string, taskId?: string) {
	const startTime = Date.now();
	
	try {
		console.log(`开始内部处理播客链接: ${url}`);
		
		// 计算当前服务的 baseUrl
		const apiBase = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
		
		// 1. 解析播客元数据
		console.log('步骤1: 解析播客元数据');
		const meta = await parseXiaoyuzhouEpisode(url);
		if (!meta.audioUrl) {
			throw new Error('无法获取音频URL');
		}

		// 解析完成后，立即将基础信息写入缓存，确保管理页可见标题/作者
		try {
			await setCachedAudio(meta.audioUrl, {
				title: meta.title || undefined,
				author: meta.author || undefined,
				originalUrl: url,
				publishedAt: meta.publishedAt ? new Date(meta.publishedAt).toISOString() : undefined,
				duration: undefined,
			});
		} catch (e) {
			console.warn('写入基础缓存失败（可忽略）:', e);
		}
		
		// 检查缓存
		const cached = await getCachedAudio(meta.audioUrl);
		if (cached && cached.script && cached.summary) {
			console.log('发现缓存，直接返回');
			return {
				success: true,
				audioUrl: meta.audioUrl,
				script: cached.script,
				summary: cached.summary,
				fromCache: true
			};
		}
		
		// 2. ASR转写
		console.log('步骤2: ASR转写');
		const asrStartTime = Date.now();
		
		// 更新ASR步骤状态
        if (taskId) {
            // 统一以“秒”为单位上报音频时长，避免前端换算错误
            const audioDurationSec = undefined;
            await updateTaskMetrics(taskId, {
                audioDuration: audioDurationSec,
                processingSteps: {
                    asr: { status: 'running' }
                }
            });
        }
		
		const asrResponse = await fetch(`${apiBase}/api/asr`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ audioUrl: meta.audioUrl })
		});
		
		if (!asrResponse.ok) {
			throw new Error(`ASR转写失败: ${asrResponse.statusText}`);
		}
		
		const asrData = await asrResponse.json();
		const asrDuration = Date.now() - asrStartTime;
		
		// 更新ASR完成指标
		if (taskId) {
			await updateTaskMetrics(taskId, {
				asrSegmentsCount: asrData.segments?.length || 0,
				processingSteps: {
					asr: { status: 'completed', duration: asrDuration }
				}
			});
		}
		if (!asrData.success) {
			throw new Error(`ASR转写失败: ${asrData.error}`);
		}

		// 将ASR转写结果与分段落地到缓存
		try {
		await setCachedAudio(meta.audioUrl, {
			transcript: asrData.transcript,
			segments: asrData.segments,
			duration: asrData.duration,
			title: meta.title || undefined,
			author: meta.author || undefined,
			originalUrl: url,
			publishedAt: meta.publishedAt ? new Date(meta.publishedAt).toISOString() : undefined,
		});
		} catch (e) {
			console.warn('写入ASR缓存失败（可忽略）:', e);
		}
		
		// 3. 清洗转录文本
		console.log('步骤3: 清洗转录文本');
		const cleaningStartTime = Date.now();
		
		// 更新清洗步骤状态
		if (taskId) {
			await updateTaskMetrics(taskId, {
				processingSteps: {
					cleaning: { status: 'running' }
				}
			});
		}
		
		// 创建自定义超时控制器
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 45 * 60 * 1000); // 45分钟超时
		
		const scriptResponse = await fetch(`${apiBase}/api/clean-transcript-abcde`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 
				transcript: asrData.transcript,
				segments: asrData.segments,
				audioUrl: meta.audioUrl 
			}),
			signal: controller.signal
		});
		
		clearTimeout(timeoutId);
		
		let scriptData: any = null;
		let cleaningFailed = false;
		
		if (!scriptResponse.ok) {
			console.warn(`文本清洗失败: ${scriptResponse.statusText}，将使用ASR原文生成总结`);
			cleaningFailed = true;
		} else {
			scriptData = await scriptResponse.json();
			if (!scriptData.success) {
				console.warn(`文本清洗失败: ${scriptData.error}，将使用ASR原文生成总结`);
				cleaningFailed = true;
			}
		}
		
		// 如果清洗失败，使用ASR原文作为备选
		if (cleaningFailed) {
			scriptData = {
				script: asrData.transcript,
				chunksCount: 1
			};
			console.log('使用ASR原文作为清洗稿（容错机制）');
		}
		
		const cleaningDuration = Date.now() - cleaningStartTime;
		
		// 计算压缩比和分块数
        const originalLength = asrData.transcript?.length || 0; // 转录总字数
        const cleanedLength = scriptData.script?.length || 0;   // 优化后访谈全文字数
        const compressionRatio = originalLength > 0 ? (cleanedLength / originalLength) : 0; // 访谈全文压缩比
		
		// 更新清洗完成指标
        if (taskId) {
            await updateTaskMetrics(taskId, {
                chunksCount: scriptData.chunksCount || 0,
                transcriptCompressionRatio: compressionRatio,
                // 额外上报计数字段，便于前端直接展示
                transcriptCharCount: originalLength,
                optimizedCharCount: cleanedLength,
                processingSteps: {
                    cleaning: { status: 'completed', duration: cleaningDuration }
                }
            });
        }
		
		// 将清洗后的访谈全文写入缓存
		try {
			await setCachedAudio(meta.audioUrl, {
				script: scriptData.script,
			});
			console.log(`清洗结果已缓存: ${cleaningFailed ? '使用ASR原文' : '使用清洗稿'}`);
		} catch (e) {
			console.warn('写入清洗结果缓存失败（可忽略）:', e);
		}

		// 4. 生成报告
		console.log('步骤4: 生成报告');
		const reportStartTime = Date.now();
		
		// 更新报告步骤状态
		if (taskId) {
			await updateTaskMetrics(taskId, {
				processingSteps: {
					report: { status: 'running' }
				}
			});
		}
		
		// 创建自定义超时控制器
		const reportController = new AbortController();
		const reportTimeoutId = setTimeout(() => reportController.abort(), 45 * 60 * 1000); // 45分钟超时
		
		// 根据清洗是否成功决定报告生成的输入
		const reportBody = cleaningFailed ? {
			// 清洗失败：只使用ASR原文
			transcript: asrData.transcript,
			originalTranscript: null,
			title: meta.title,
			audioUrl: meta.audioUrl 
		} : {
			// 清洗成功：使用清洗稿+ASR原文
			transcript: scriptData.script,
			originalTranscript: asrData.transcript,
			title: meta.title,
			audioUrl: meta.audioUrl 
		};
		
		console.log(`报告生成策略: ${cleaningFailed ? '仅使用ASR原文' : '使用清洗稿+ASR原文'}`);
		
		const reportResponse = await fetch(`${apiBase}/api/generate-report-whole`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(reportBody),
			signal: reportController.signal
		});
		
		clearTimeout(reportTimeoutId);
		
		if (!reportResponse.ok) {
			throw new Error(`报告生成失败: ${reportResponse.statusText}`);
		}
		
		const reportData = await reportResponse.json();
		if (!reportData.success) {
			throw new Error(`报告生成失败: ${reportData.error}`);
		}
		
		const reportDuration = Date.now() - reportStartTime;
		
		// 计算报告压缩比
        // 报告字段为 summary，使用其长度计算“播客总结压缩比” = 总结字数 / 访谈全文字数
        const reportLength = reportData.summary?.length || 0;
        const reportCompressionRatio = cleanedLength > 0 ? (reportLength / cleanedLength) : 0;
		
		// 更新报告完成指标
        if (taskId) {
            await updateTaskMetrics(taskId, {
                reportCompressionRatio: reportCompressionRatio,
                summaryCharCount: reportLength,
                processingSteps: {
                    report: { status: 'completed', duration: reportDuration }
                }
            });
        }
		
		// 将报告(summary)写入缓存
		try {
			await setCachedAudio(meta.audioUrl, {
				summary: reportData.summary,
			});
		} catch (e) {
			console.warn('写入报告缓存失败（可忽略）:', e);
		}

		// 5. 保存到数据库
		console.log('步骤5: 保存到数据库');
		if (userId) {
			try {
				const podcast = await withRetry(async () => {
					return await db.podcast.create({
						data: {
							title: meta.title || '未命名播客',
							sourceUrl: url,
							audioUrl: meta.audioUrl,
							description: meta.description || null,
							publishedAt: meta.publishedAt ? new Date(meta.publishedAt) : null,
							duration: asrData.duration,
							status: 'READY',
							originalTranscript: asrData.transcript,
							transcript: scriptData.script,
							summary: reportData?.summary || null,
							showAuthor: meta.author || null,
							processingStartedAt: new Date(startTime),
							processingCompletedAt: new Date(),
							createdById: userId
						}
					});
				});
				console.log(`播客已保存到数据库: ${podcast.id}`);
			} catch (error: unknown) {
				console.error('保存到数据库失败:', error);
				// 不抛出错误，继续执行
			}
		}
		
		console.log(`播客处理完成，总耗时: ${Date.now() - startTime}ms`);
		
		return {
			success: true,
			audioUrl: meta.audioUrl,
			script: scriptData.script,
			summary: reportData?.summary || null,
			processingTime: Date.now() - startTime
		};
		
	} catch (error: unknown) {
		console.error('播客处理失败:', error);
		throw new Error(error instanceof Error ? error.message : String(error));
	}
}
