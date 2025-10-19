import { z } from "zod";
import { jsonError } from "@/utils/http";
import { parseXiaoyuzhouEpisode } from "@/server/parsers/xiaoyuzhou";
import { getCachedAudio, setCachedAudio } from "@/server/audio-cache";
import { recordASRUsage, recordLLMUsage } from "@/server/monitoring";
import { db } from "@/server/db";

// 内部处理函数，可以被TaskQueue调用
export async function processAudioInternal(url: string, userId?: string) {
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
		const asrResponse = await fetch(`${apiBase}/api/asr`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ audioUrl: meta.audioUrl })
		});
		
		if (!asrResponse.ok) {
			throw new Error(`ASR转写失败: ${asrResponse.statusText}`);
		}
		
		const asrData = await asrResponse.json();
		if (!asrData.success) {
			throw new Error(`ASR转写失败: ${asrData.error}`);
		}
		
		// 3. 清洗转录文本
		console.log('步骤3: 清洗转录文本');
		const scriptResponse = await fetch(`${apiBase}/api/clean-transcript-abcde`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 
				transcript: asrData.transcript,
				segments: asrData.segments,
				audioUrl: meta.audioUrl 
			})
		});
		
		if (!scriptResponse.ok) {
			throw new Error(`文本清洗失败: ${scriptResponse.statusText}`);
		}
		
		const scriptData = await scriptResponse.json();
		if (!scriptData.success) {
			throw new Error(`文本清洗失败: ${scriptData.error}`);
		}
		
		// 4. 生成报告
		console.log('步骤4: 生成报告');
		const reportResponse = await fetch(`${apiBase}/api/generate-report-whole`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 
				script: scriptData.script,
				audioUrl: meta.audioUrl 
			})
		});
		
		if (!reportResponse.ok) {
			throw new Error(`报告生成失败: ${reportResponse.statusText}`);
		}
		
		const reportData = await reportResponse.json();
		if (!reportData.success) {
			throw new Error(`报告生成失败: ${reportData.error}`);
		}
		
		// 5. 保存到数据库
		console.log('步骤5: 保存到数据库');
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
						status: 'READY',
						originalTranscript: asrData.transcript,
						transcript: scriptData.script,
						summary: reportData?.summary || null,
						processingStartedAt: new Date(startTime),
						processingCompletedAt: new Date(),
						createdById: userId
					}
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
