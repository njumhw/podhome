import { z } from "zod";
import { jsonError } from "@/utils/http";
import { parseXiaoyuzhouEpisode } from "@/server/parsers/xiaoyuzhou";
import { parseXiaoyuzhouEpisode as parseXiaoyuzhouEpisodeSimple } from "@/server/parsers/xiaoyuzhou-simple";
import { getCachedAudio, setCachedAudio } from "@/server/audio-cache";
import { recordASRUsage, recordLLMUsage } from "@/server/monitoring";
import { db } from "@/server/db";
import { withRetry } from "@/utils/error-handler";
import { transcribeWithAliyunASR } from "@/server/asr";
import { generateReportWhole } from "@/clients/report-generator";
import { analyzeError, logErrorAnalysis, createErrorContext } from "@/utils/error-analyzer";

// 更新任务指标的函数
async function updateTaskMetrics(taskId: string, metrics: any) {
  try {
    // 如果 taskId 以 test_ 开头，说明是测试调用，跳过数据库更新
    if (taskId && taskId.startsWith('test_')) {
      console.log(`[测试模式] 跳过任务指标更新: ${taskId}`);
      return;
    }
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
    // 如果任务不存在，只记录警告，不中断处理
    console.warn('更新任务指标失败（可能是测试调用或任务不存在）:', error);
  }
}

// 内部处理函数，可以被TaskQueue调用
export async function processAudioInternal(url: string, userId?: string, taskId?: string) {
	const startTime = Date.now();
	
	// 在函数作用域声明变量，确保在catch块中可访问
	let meta: any = null;
	let asrResult: any = null;
	let asrSegmentTexts: string[] = []; // 添加 asrSegmentTexts 到函数作用域
	let asrDuration: number = 0; // 添加 asrDuration 到函数作用域
	let reportData: any = null;
	
	try {
		console.log(`开始内部处理播客链接: ${url}`);
		
		// 计算当前服务的 baseUrl
		const apiBase = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
		
		// 1. 解析播客元数据
		const step1StartTime = Date.now();
		console.log('步骤1: 解析播客元数据');
		console.log(`[步骤1] 开始时间: ${new Date().toISOString()}`);
		try {
			// 使用简化版解析器（静态导入，避免动态导入问题）
			console.log(`[步骤1] 准备调用解析器: ${url}`);
			meta = await parseXiaoyuzhouEpisodeSimple(url);
			console.log(`[步骤1] 解析器返回结果:`, meta ? '成功' : '失败');
			if (!meta.audioUrl) {
				throw new Error('无法获取音频URL');
			}
			console.log(`✅ 步骤1完成，耗时: ${((Date.now() - step1StartTime) / 1000).toFixed(1)}秒`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`[步骤1] ❌ 解析失败: ${errorMessage}`);
			console.error(`[步骤1] 错误堆栈:`, error instanceof Error ? error.stack?.substring(0, 500) : '无');
			const context = createErrorContext('解析播客元数据', 1, step1StartTime, { url });
			const analysis = analyzeError(error, context);
			logErrorAnalysis(analysis);
			throw error;
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
		
		// 检查缓存（仅用于预填信息，不再早退）
		const cached = await getCachedAudio(meta.audioUrl);
		if (cached) {
			console.log('发现缓存，但已强制全量处理，继续执行完整流程');
		}
		
		// 2. ASR转写
		const step2StartTime = Date.now();
		console.log('步骤2: ASR转写');
		
		// 更新ASR步骤状态
        if (taskId) {
            // 统一以"秒"为单位上报音频时长，避免前端换算错误
            const audioDurationSec = undefined;
            await updateTaskMetrics(taskId, {
                audioDuration: audioDurationSec,
                processingSteps: {
                    asr: { status: 'running' }
                }
            });
        }
		
		// asrResult 已在函数作用域声明
		try {
			// 直接调用ASR内部函数，避免HTTP请求失败
			// 使用静态导入，避免 Turbopack 模块加载问题
			asrResult = await transcribeWithAliyunASR(meta.audioUrl);
			asrDuration = Date.now() - step2StartTime; // 使用函数作用域的变量
			
			// 提取ASR原始分段文本（用于报告生成时保持语义边界）
			// asrResult.speakers中的text字段就是原始的ASR分段文本
			// asrSegmentTexts 已在函数作用域声明
			asrSegmentTexts = asrResult.speakers?.map((speaker: { text: string }) => speaker.text).filter((text: string | undefined): text is string => text !== undefined && text.trim() !== '') || [];
			
			// 检查ASR是否成功
			if (!asrResult.success) {
				const asrError = asrResult.error || 'ASR转写失败';
				throw new Error(`ASR转写失败: ${asrError}`);
			}
			
			console.log(`✅ 步骤2完成，耗时: ${(asrDuration / 1000).toFixed(1)}秒，ASR原文: ${asrResult.transcript.length.toLocaleString()}字符`);
		} catch (error) {
			const context = createErrorContext('ASR转写', 2, step2StartTime, { 
				audioUrl: meta.audioUrl,
				duration: meta.duration 
			});
			const analysis = analyzeError(error, context);
			logErrorAnalysis(analysis);
			throw error;
		}
		
		// 转换为API格式
		const asrData = {
			success: asrResult.success,
			transcript: asrResult.transcript,
			segments: asrResult.speakers.map((speaker: { speaker: string; startTime: number; endTime: number; text: string }) => ({
				startTime: speaker.startTime,
				endTime: speaker.endTime,
				text: speaker.text,
				speaker: speaker.speaker
			})),
			segmentTexts: asrSegmentTexts, // 保存原始分段文本数组
			duration: asrResult.duration,
			error: asrResult.error
		};
		
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
			segments: asrData.segments?.map((segment: { startTime: number; endTime: number; text: string; speaker: string }) => JSON.stringify(segment)) || [],
			duration: asrData.duration,
			title: meta.title || undefined,
			author: meta.author || undefined,
			originalUrl: url,
			publishedAt: meta.publishedAt ? new Date(meta.publishedAt).toISOString() : undefined,
		});
		} catch (e) {
			console.warn('写入ASR缓存失败（可忽略）:', e);
		}
		
        // 3.（已移除）清洗流程：直接跳过，使用ASR原文作为“文本稿”
        console.log('步骤3: 跳过清洗流程，直接使用ASR原文');
        const originalLength = asrData.transcript?.length || 0;
        const scriptData: any = { script: asrData.transcript, chunksCount: 1 };

		// 4. 生成报告
		const step4StartTime = Date.now();
		console.log('步骤4: 生成报告');
		
		// 更新报告步骤状态
		if (taskId) {
			await updateTaskMetrics(taskId, {
				processingSteps: {
					report: { status: 'running' }
				}
			});
		}
		
		// 直接调用内部报告生成函数，而不是HTTP请求
		// 使用静态导入的函数
		// 新逻辑：播客总结仅基于ASR原文生成，清洗稿作为独立输出
		// 使用ASR原始分段文本（73段），用于分块报告生成时保持语义边界
		const reportBody = {
			// 无论清洗成功与否，都只使用ASR原文生成总结
			transcript: asrData.transcript,  // ASR原文（唯一源）
			// originalTranscript 不再提供
			segments: asrData.segmentTexts && asrData.segmentTexts.length > 0 ? asrData.segmentTexts : undefined, // ASR分段（73段），优先使用此进行分块
			title: meta.title || undefined,
			audioUrl: meta.audioUrl 
		};
		
		if (asrData.segmentTexts && asrData.segmentTexts.length > 0) {
			console.log(`✅ ASR分段已传递: ${asrData.segmentTexts.length} 段，报告生成时将保持语义边界`);
		}
		
		console.log(`报告生成策略: 仅基于ASR原文生成总结（清洗稿作为独立输出，不参与总结生成）`);
		console.log(`ASR原文长度: ${asrData.transcript.length} 字符`);
		console.log(`预期处理时间: 约${Math.ceil(asrData.transcript.length / 1000)}秒（基于1K字符/秒的估算）`);
		
		// 报告生成失败不应该阻止保存到数据库
		// reportData 已在函数作用域声明
		let reportGenerationFailed = false;
		
		try {
			console.log('开始调用generateReportWhole生成播客总结...');
			const reportStartTimestamp = Date.now();
			
			// 根据ASR原文长度动态调整超时时间
			// 估算：每1000字符约需1秒处理时间，加上安全边际
			// 对于144K字符，预计需要144秒（约2.4分钟）处理，但考虑到生成32K token输出，需要更长时间
			// 保守估算：每1000字符需要10秒（包括输入处理和输出生成）
			const estimatedSeconds = Math.ceil(asrData.transcript.length / 100); // 每100字符1秒
			const minTimeout = 60 * 60 * 1000; // 最少60分钟
			const maxTimeout = 2 * 60 * 60 * 1000; // 最多120分钟（2小时）
			const dynamicTimeout = Math.min(Math.max(estimatedSeconds * 1000, minTimeout), maxTimeout);
			
			console.log(`ASR原文长度: ${asrData.transcript.length} 字符`);
			console.log(`估算处理时间: ${Math.ceil(estimatedSeconds / 60)} 分钟`);
			console.log(`设置超时时间: ${Math.ceil(dynamicTimeout / 60000)} 分钟`);
			
			// 添加超时包装，确保长时间运行不会卡住
			// 注意：使用Promise.race可能导致超时时丢失已生成的大纲
			// 因此我们需要在超时前检查是否有部分结果
			const reportPromise = generateReportWhole(reportBody);
			let timeoutId: NodeJS.Timeout | null = null;
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(new Error(`报告生成超时（超过${Math.ceil(dynamicTimeout / 60000)}分钟）`));
				}, dynamicTimeout);
			});
			
			try {
				reportData = await Promise.race([reportPromise, timeoutPromise]);
				// 如果成功完成，清除超时定时器
				if (timeoutId) clearTimeout(timeoutId);
			} catch (raceError) {
				// 如果是超时错误，尝试等待reportPromise完成（可能已经生成了大纲）
				if (timeoutId) clearTimeout(timeoutId);
				const errorMessage = raceError instanceof Error ? raceError.message : String(raceError);
				if (errorMessage.includes('超时')) {
					console.warn('⚠️ 报告生成超时，尝试获取部分结果（可能已生成大纲）...');
					try {
						// 等待一小段时间，看看reportPromise是否已经生成了大纲
						const partialResult = await Promise.race([
							reportPromise,
							new Promise<never>((_, reject) => setTimeout(() => reject(new Error('等待超时')), 5000))
						]);
						if (partialResult && partialResult.outline) {
							console.log(`✅ 虽然报告生成超时，但已获取到大纲（${partialResult.outline.length}字符），将保存大纲`);
							reportData = partialResult;
						} else {
							throw raceError; // 没有大纲，抛出原始超时错误
						}
					} catch (partialError) {
						// 无法获取部分结果，抛出原始超时错误
						throw raceError;
					}
				} else {
					// 其他错误，直接抛出
					throw raceError;
				}
			}
			
			const actualReportDuration = Date.now() - reportStartTimestamp;
			
			// 检查是否有大纲（优先检查）
			if (reportData.outline) {
				console.log(`✅ 报告大纲已生成，长度: ${reportData.outline.length} 字符`);
				console.log(`大纲预览（前200字符）: ${reportData.outline.substring(0, 200)}...`);
			} else {
				console.warn('⚠️ 报告大纲未生成（可能使用了回退方案）');
				console.warn('⚠️ 这意味着使用了单轮生成模式，不会生成大纲');
			}
			
			// 检查是否有总结
			if (reportData.summary && reportData.summary.length > 0) {
				console.log(`✅ 播客总结生成成功，耗时: ${(actualReportDuration / 1000).toFixed(1)}秒`);
				console.log(`总结长度: ${reportData.summary.length} 字符`);
			} else {
				console.warn('⚠️ 播客总结为空（可能只生成了大纲）');
			}
		
		} catch (reportError) {
			reportGenerationFailed = true;
			const reportDuration = Date.now() - step4StartTime;
			const errorMessage = reportError instanceof Error ? reportError.message : String(reportError);
			
			// 使用错误分析工具
			const context = createErrorContext('生成报告', 4, step4StartTime, {
				transcriptLength: asrData.transcript.length,
				segmentCount: asrData.segmentTexts?.length || 0,
				title: meta.title
			});
			const analysis = analyzeError(reportError, context);
			logErrorAnalysis(analysis);
			
			console.error('❌ 报告生成失败，但将继续保存播客记录:', errorMessage);
			console.error('错误详情:', reportError);
			
			// 更新报告失败指标
			if (taskId) {
				await updateTaskMetrics(taskId, {
					processingSteps: {
						report: { status: 'failed', duration: reportDuration, error: errorMessage }
					}
				});
			}
		}
		
		const reportDuration = Date.now() - step4StartTime;
		
        // 计算报告压缩比（如果报告生成成功）。清洗已移除，使用ASR长度作为基准
        const reportLength = reportData?.summary?.length || 0;
        const reportCompressionRatio = originalLength > 0 && reportLength > 0 ? (reportLength / originalLength) : 0;
		
		// 更新报告完成指标
        // 关键修复：只有当reportData存在且summary不为空时，才更新为completed
        // 防御性检查：即使reportGenerationFailed为false，如果reportData为null或summary为空，也不应该标记为completed
        if (taskId && !reportGenerationFailed && reportData && reportData.summary && reportData.summary.trim().length > 0) {
            await updateTaskMetrics(taskId, {
                reportCompressionRatio: reportCompressionRatio,
                summaryCharCount: reportLength,
                processingSteps: {
                    report: { status: 'completed', duration: reportDuration }
                }
            });
        } else if (taskId && (!reportData || !reportData.summary || reportData.summary.trim().length === 0)) {
            // 如果reportData为null或summary为空，但之前没有标记为失败，需要标记
            // 这种情况理论上不应该发生（因为generateReportWhole应该抛出错误），但作为防御性检查
            if (!reportGenerationFailed) {
                console.warn('⚠️ 警告：reportData存在但summary为空，标记为失败');
                await updateTaskMetrics(taskId, {
                    processingSteps: {
                        report: { status: 'failed', duration: reportDuration, error: 'summary为空但未抛出错误' }
                    }
                });
            }
        }
		
		// 将报告(summary)写入缓存（如果生成成功）
		if (reportData?.summary) {
			try {
				await setCachedAudio(meta.audioUrl, {
					summary: reportData.summary,
				});
			} catch (e) {
				console.warn('写入报告缓存失败（可忽略）:', e);
			}
		}

		// 5. 保存到数据库
		const step5StartTime = Date.now();
		console.log('步骤5: 保存到数据库');
		console.log(`userId: ${userId || '未提供'}`);
		// 无论是否登录，都尝试保存到数据库（如果有userId）
		if (userId) {
			try {
				// 首先验证userId是否存在（避免外键约束错误）
				console.log(`验证用户ID: ${userId}`);
				const userExists = await db.user.findUnique({
					where: { id: userId },
					select: { id: true }
				});
				
				if (!userExists) {
					throw new Error(`用户ID不存在: ${userId}。无法创建播客记录。`);
				}
				console.log(`✅ 用户验证通过: ${userId}`);
				
				const podcast = await withRetry(async () => {
					// 先自动标注主题（如果还没有主题）
					let autoTaggedTopicId: string | null = null;
					try {
						const { autoTagPodcast } = await import('./topic-auto-tagger');
						const suggestedTopic = await autoTagPodcast({
							title: (meta.title || '未命名播客').substring(0, 500).trim(),
							sourceUrl: url.substring(0, 2000).trim(),
							description: meta.description ? meta.description.substring(0, 10000).trim() : null,
							showAuthor: meta.author ? meta.author.substring(0, 200).trim() : null,
							summary: reportData?.summary || null,
							originalTranscript: asrData.transcript || null,
						});
						
						if (suggestedTopic) {
							const topic = await db.topic.findUnique({
								where: { name: suggestedTopic },
								select: { id: true },
							});
							if (topic) {
								autoTaggedTopicId = topic.id;
								console.log(`✅ 自动标注主题: ${suggestedTopic}`);
							}
						}
					} catch (tagError) {
						// 自动标注失败不影响主流程
						console.warn('⚠️ 自动标注主题失败:', tagError);
					}
					
					// 构建数据对象，如果reportOutline字段不存在则忽略
					// 确保所有字段都符合schema要求
					const podcastData: any = {
						title: (meta.title || '未命名播客').substring(0, 500).trim(), // 限制title长度，避免过长，并去除首尾空格
						sourceUrl: url.substring(0, 2000).trim(), // 限制URL长度，并去除首尾空格
						audioUrl: meta.audioUrl ? meta.audioUrl.substring(0, 2000).trim() : null, // 限制URL长度，并去除首尾空格
						description: meta.description ? meta.description.substring(0, 10000).trim() : null, // 限制description长度，并去除首尾空格
						publishedAt: meta.publishedAt ? new Date(meta.publishedAt) : null,
						duration: asrData.duration ? Math.floor(asrData.duration) : null, // 确保是整数或null
						status: 'READY' as const, // PodcastStatus枚举值
						originalTranscript: asrData.transcript || null, // 确保不是undefined
						transcript: null, // 清洗已移除
						summary: reportData?.summary || null, // 即使报告生成失败，summary为null也能保存
						showAuthor: meta.author ? meta.author.substring(0, 200).trim() : null, // 限制author长度，并去除首尾空格
						processingStartedAt: new Date(startTime),
						processingCompletedAt: new Date(),
						createdById: userId, // 已验证用户存在，直接设置createdById
						topicId: autoTaggedTopicId, // 自动标注的主题ID
					};
					
					// 如果reportOutline字段存在，则添加
					const outline = reportData?.outline;
					if (outline && typeof outline === 'string' && outline.trim().length > 0) {
						podcastData.reportOutline = outline; // reportOutline字段没有长度限制，但确保是字符串
						console.log(`✅ 准备保存报告大纲，长度: ${outline.length} 字符`);
						console.log(`大纲内容预览: ${outline.substring(0, 300)}...`);
					} else {
						console.warn('⚠️ 报告大纲为空或不存在，不会保存到数据库');
						console.warn('⚠️ reportData.outline 值:', reportData?.outline);
						console.warn('⚠️ 这通常意味着使用了单轮生成模式（回退方案）');
					}
					
					// 验证必填字段
					if (!podcastData.title || podcastData.title.trim().length === 0) {
						throw new Error('标题不能为空');
					}
					if (!podcastData.sourceUrl || podcastData.sourceUrl.trim().length === 0) {
						throw new Error('源URL不能为空');
					}
					
					console.log('准备保存播客数据:', {
						title: podcastData.title.substring(0, 50) + '...',
						sourceUrl: podcastData.sourceUrl.substring(0, 50) + '...',
						audioUrl: podcastData.audioUrl ? podcastData.audioUrl.substring(0, 50) + '...' : null,
						duration: podcastData.duration,
						originalTranscriptLength: podcastData.originalTranscript?.length || 0,
						summaryLength: podcastData.summary?.length || 0,
						reportOutlineLength: podcastData.reportOutline?.length || 0,
						status: podcastData.status
					});
					
					// 最终验证：确保所有必填字段都存在且有效
					if (!podcastData.title || podcastData.title.trim().length === 0) {
						throw new Error('标题不能为空');
					}
					if (!podcastData.sourceUrl || podcastData.sourceUrl.trim().length === 0) {
						throw new Error('源URL不能为空');
					}
					if (!userId) {
						throw new Error('userId不能为空');
					}
					
					// 确保status是有效的枚举值
					if (podcastData.status !== 'READY' && podcastData.status !== 'PROCESSING' && podcastData.status !== 'FAILED') {
						throw new Error(`无效的status值: ${podcastData.status}`);
					}
					
					// 使用显式类型，确保Prisma能正确识别字段
					const createData: {
							title: string;
							sourceUrl: string;
							audioUrl: string | null;
							description: string | null;
							publishedAt: Date | null;
							duration: number | null;
							status: 'READY';
							originalTranscript: string | null;
							transcript: null;
							summary: string | null;
							showAuthor: string | null;
							processingStartedAt: Date;
							processingCompletedAt: Date;
							createdById: string;
							topicId?: string | null;
							reportOutline?: string;
					} = {
						title: podcastData.title,
						sourceUrl: podcastData.sourceUrl,
						audioUrl: podcastData.audioUrl,
						description: podcastData.description,
						publishedAt: podcastData.publishedAt,
						duration: podcastData.duration,
						status: podcastData.status,
						originalTranscript: podcastData.originalTranscript,
						transcript: null,
						summary: podcastData.summary,
						showAuthor: podcastData.showAuthor,
						processingStartedAt: podcastData.processingStartedAt,
						processingCompletedAt: podcastData.processingCompletedAt,
						createdById: userId,
						topicId: autoTaggedTopicId,
					};
					
					if (podcastData.reportOutline) {
						createData.reportOutline = podcastData.reportOutline;
					}
					
					try {
						return await db.podcast.create({
							data: createData
						});
					} catch (prismaError: any) {
						// 捕获并记录完整的 Prisma 错误信息
						const errorMessage = prismaError?.message || String(prismaError);
						const errorCode = prismaError?.code;
						const errorMeta = prismaError?.meta;
						
						// 记录完整的错误堆栈
						const errorStack = prismaError?.stack;
						
						console.error('═══════════════════════════════════════════════════════════');
						console.error('Prisma创建失败 - 完整错误信息:');
						console.error('═══════════════════════════════════════════════════════════');
						console.error('错误消息:', errorMessage);
						console.error('错误代码:', errorCode);
						console.error('错误元数据:', JSON.stringify(errorMeta, null, 2));
						if (errorStack) {
							console.error('错误堆栈:', errorStack.substring(0, 1000));
						}
						console.error('');
						console.error('尝试保存的数据摘要:');
						console.error({
							title: podcastData.title?.substring(0, 100),
							sourceUrl: podcastData.sourceUrl?.substring(0, 100),
							audioUrl: podcastData.audioUrl?.substring(0, 100) || null,
							duration: podcastData.duration,
							status: podcastData.status,
							hasOriginalTranscript: !!podcastData.originalTranscript,
							originalTranscriptLength: podcastData.originalTranscript?.length || 0,
							hasSummary: !!podcastData.summary,
							summaryLength: podcastData.summary?.length || 0,
							hasReportOutline: !!podcastData.reportOutline,
							reportOutlineLength: podcastData.reportOutline?.length || 0,
							createdById: podcastData.createdById,
							showAuthor: podcastData.showAuthor?.substring(0, 50) || null,
							description: podcastData.description ? `${podcastData.description.substring(0, 100)}...` : null
						});
						console.error('═══════════════════════════════════════════════════════════');
						
						// 根据错误代码提供更具体的错误信息
						let detailedError = errorMessage;
						if (errorCode === 'P2002') {
							detailedError = `唯一约束冲突: ${errorMeta?.target?.join(', ') || '未知字段'}`;
						} else if (errorCode === 'P2003') {
							detailedError = `外键约束失败: ${errorMeta?.field_name || '未知字段'}`;
						} else if (errorCode === 'P2011') {
							detailedError = `空值约束失败: ${errorMeta?.constraint || '未知约束'}`;
						} else if (errorCode === 'P2012') {
							detailedError = `必填字段缺失: ${errorMeta?.path || '未知字段'}`;
						}
						
						// 重新抛出错误，包含更详细的信息
						throw new Error(`Prisma创建失败: ${detailedError} (代码: ${errorCode || 'N/A'})`);
					}
				});
				console.log(`播客已保存到数据库: ${podcast.id}${reportGenerationFailed ? '（报告生成失败，但ASR和清洗数据已保存）' : ''}`);
				
				// 返回结果，包含播客ID以便前端跳转
				const isPartialSuccess = reportGenerationFailed;
				console.log(`播客处理完成，总耗时: ${Date.now() - startTime}ms`);
				
				return {
					success: !isPartialSuccess, // 如果报告生成失败，返回false
					id: podcast.id, // 添加播客ID，用于前端跳转
					audioUrl: meta.audioUrl,
					script: null, // 清洗已移除
					summary: reportData?.summary || null,
					reportOutline: reportData?.outline || null, // 添加大纲
					processingTime: Date.now() - startTime,
					partialSuccess: isPartialSuccess, // 标记为部分成功
					error: isPartialSuccess ? '报告生成失败或超时，但ASR转写已成功完成' : undefined
				};
			} catch (error: unknown) {
				const dbDuration = Date.now() - step5StartTime;
				const errorMessage = error instanceof Error ? error.message : String(error);
				
				// 使用错误分析工具
				const context = createErrorContext('保存到数据库', 5, step5StartTime, {
					userId,
					hasReport: !!reportData?.summary,
					reportLength: reportData?.summary?.length || 0,
					asrLength: asrData.transcript.length
				});
				const analysis = analyzeError(error, context);
				logErrorAnalysis(analysis);
				
				console.error('保存到数据库失败:', error);
				// 如果保存失败，这应该是一个真正的错误，需要抛出
				throw new Error(`保存播客到数据库失败: ${errorMessage}`);
			}
		} else {
			console.warn('未提供userId，跳过保存到数据库');
			// 即使没有userId，也返回处理结果（但不包含id）
			const isPartialSuccess = reportGenerationFailed;
			console.log(`播客处理完成（未保存到数据库），总耗时: ${Date.now() - startTime}ms`);
			
			return {
				success: !isPartialSuccess,
				audioUrl: meta.audioUrl,
				script: null,
				summary: reportData?.summary || null,
				reportOutline: reportData?.outline || null,
				processingTime: Date.now() - startTime,
				partialSuccess: isPartialSuccess,
				error: isPartialSuccess ? '报告生成失败或超时，但ASR转写已成功完成' : undefined
			};
		}
		
	} catch (error: unknown) {
		const totalDuration = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		
		// 使用错误分析工具进行最终分析
		const context = createErrorContext('整体处理流程', 0, startTime, {
			url,
			userId,
			totalDuration,
			hasMeta: !!meta,
			hasAsr: !!asrResult?.success,
			hasReport: !!reportData?.summary
		});
		const analysis = analyzeError(error, context);
		logErrorAnalysis(analysis);
		
		console.error('═══════════════════════════════════════════════════════════');
		console.error('💥 播客处理流程失败');
		console.error('═══════════════════════════════════════════════════════════');
		console.error('总耗时:', `${(totalDuration / 1000).toFixed(1)}秒`);
		console.error('错误信息:', errorMessage);
		if (errorStack) {
			console.error('错误堆栈（前1000字符）:', errorStack.substring(0, 1000));
		}
		console.error('═══════════════════════════════════════════════════════════\n');
		
		// 确保错误信息详细，便于调试
		let detailedError = errorMessage;
		// 如果错误信息是简化的 "fetch failed"，尝试从错误堆栈中提取更多信息
		if (errorMessage === 'fetch failed' || errorMessage.toLowerCase().includes('fetch failed')) {
			// 尝试从堆栈中提取更多信息
			if (errorStack) {
				const stackLines = errorStack.split('\n');
				const relevantLine = stackLines.find(line => 
					line.includes('parseXiaoyuzhouEpisode') || 
					line.includes('fetchHtml') ||
					line.includes('网络请求失败')
				);
				if (relevantLine) {
					detailedError = `网络请求失败: ${errorMessage} (${relevantLine.trim()})`;
				} else {
					detailedError = `网络请求失败: ${errorMessage}。请检查网络连接或稍后重试。`;
				}
			} else {
				detailedError = `网络请求失败: ${errorMessage}。请检查网络连接或稍后重试。`;
			}
		} else if (errorMessage.includes('fetch') && !errorMessage.includes('失败')) {
			detailedError = `网络请求失败: ${errorMessage}`;
		} else if (errorMessage.includes('下载')) {
			detailedError = `音频下载失败: ${errorMessage}`;
		} else if (errorMessage.includes('模块') || errorMessage.includes('Module')) {
			detailedError = `模块加载失败: ${errorMessage}`;
		}
		
		throw new Error(detailedError);
	}
}
