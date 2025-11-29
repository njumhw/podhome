import { getEnv } from "@/utils/env";
import { ASR_CONFIG } from "./asr-config";
import { transcribeAudioWithSegmentation } from "./asr-segmented";
import { analyzeError, logErrorAnalysis, createErrorContext } from "@/utils/error-analyzer";

// 重新导出，保持向后兼容
export { ASR_CONFIG };

export interface ASRResult {
	success: boolean;
	transcript: string;
	speakers: Array<{
		speaker: string;
		startTime: number;
		endTime: number;
		text: string;
	}>;
	duration: number;
	error?: string;
}

export interface AudioSegment {
	url: string;
	startTime: number;
	endTime: number;
	duration: number;
	fileSize: number;
}

/**
 * 检查音频片段是否符合阿里云ASR要求
 */
export function validateAudioForASR(segment: AudioSegment): { valid: boolean; issues: string[] } {
	const issues: string[] = [];
	
	if (segment.duration > ASR_CONFIG.maxDuration) {
		issues.push(`时长超限: ${segment.duration}秒 > ${ASR_CONFIG.maxDuration}秒`);
	}
	
	if (segment.fileSize > ASR_CONFIG.maxFileSize) {
		issues.push(`文件大小超限: ${(segment.fileSize / 1024 / 1024).toFixed(2)}MB > ${ASR_CONFIG.maxFileSize / 1024 / 1024}MB`);
	}
	
	return {
		valid: issues.length === 0,
		issues
	};
}

/**
 * 调用阿里云ASR进行语音转文字
 * 按照正确的流程：先按120秒切割音频，再分别转写每个片段
 * @param audioUrl 音频URL
 * @param language 语言代码，默认为 "auto"（自动检测），支持 "zh"（中文）、"en"（英文）
 */
export async function transcribeWithAliyunASR(audioUrl: string, language: string = "auto"): Promise<ASRResult> {
    try {
        // 使用分段转写：按120秒切割音频，分别转写每个片段
        // 使用 "auto" 自动检测语言，支持中文和英文播客
        const result = await transcribeAudioWithSegmentation(audioUrl, language);
        
        const transcript = result.transcript;
        const segments = result.segments; // 73个ASR片段（对于146分钟音频）
        const duration = result.duration;
        
        // 将ASR片段转换为speaker格式（每个片段对应120秒音频）
        const speakers = segments.map((segmentText, idx) => ({
            speaker: `Speaker${Math.floor(idx / 10) + 1}`, // 简单的说话人分配
            startTime: idx * ASR_CONFIG.maxDuration, // 120秒 * 索引
            endTime: Math.min((idx + 1) * ASR_CONFIG.maxDuration, duration),
            text: segmentText
        }));
        
        console.log(`分段ASR转写完成: ${segments.length} 个片段，总字符数 ${transcript.length}，总时长 ${duration}秒`);
        
        return {
            success: true,
            transcript,
            speakers,
            duration: duration
        };
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        // 使用错误分析工具
        const context = createErrorContext('ASR转写（分段处理）', 2, Date.now(), {
            audioUrl,
            segmentDuration: ASR_CONFIG.maxDuration
        });
        const analysis = analyzeError(error, context);
        logErrorAnalysis(analysis);
        
        console.error('分段ASR转写失败:', errorMessage);
        if (errorStack) {
            console.error('错误堆栈:', errorStack.substring(0, 500));
        }
        
        // 提供更详细的错误信息
        let detailedError = errorMessage;
        if (errorMessage.includes('下载') || errorMessage.includes('fetch')) {
            detailedError = `音频下载失败: ${errorMessage}`;
        } else if (errorMessage.includes('OSS') || errorMessage.includes('上传')) {
            detailedError = `OSS上传失败: ${errorMessage}`;
        } else if (errorMessage.includes('模块') || errorMessage.includes('Module')) {
            detailedError = `模块加载失败: ${errorMessage}`;
        } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
            detailedError = `处理超时: ${errorMessage}`;
        }
        
        return {
            success: false,
            transcript: '',
            speakers: [],
            duration: 0,
            error: detailedError
        };
    }
}

/**
 * 模拟ASR转写（用于测试）
 */
// 已移除mock实现，禁止回退到极短路径

/**
 * 批量处理多个音频片段
 */
export async function transcribeMultipleSegments(segments: AudioSegment[]): Promise<ASRResult[]> {
	const results: ASRResult[] = [];
	
	// 并发处理，但限制并发数
	const CONCURRENT_LIMIT = 3;
	
	for (let i = 0; i < segments.length; i += CONCURRENT_LIMIT) {
		const batch = segments.slice(i, i + CONCURRENT_LIMIT);
		
		const batchResults = await Promise.all(
			batch.map(async (segment) => {
				// 验证音频片段
				const validation = validateAudioForASR(segment);
				if (!validation.valid) {
					return {
						success: false,
						transcript: '',
						speakers: [],
						duration: segment.duration,
						error: `音频片段不符合ASR要求: ${validation.issues.join(', ')}`
					};
				}
				
				// 调用ASR转写
				return await transcribeWithAliyunASR(segment.url);
			})
		);
		
		results.push(...batchResults);
	}
	
	return results;
}

/**
 * 合并多个ASR结果
 */
export function mergeASRResults(results: ASRResult[]): ASRResult {
	const successful = results.filter(r => r.success);
	const failed = results.filter(r => !r.success);
	
	if (successful.length === 0) {
		return {
			success: false,
			transcript: '',
			speakers: [],
			duration: 0,
			error: `所有转写都失败: ${failed.map(f => f.error).join(', ')}`
		};
	}
	
	// 合并成功的转写结果
	const allSpeakers = successful.flatMap(r => r.speakers);
	const totalDuration = successful.reduce((sum, r) => sum + r.duration, 0);
	const fullTranscript = successful.map(r => r.transcript).join('\n\n');
	
	return {
		success: true,
		transcript: fullTranscript,
		speakers: allSpeakers,
		duration: totalDuration
	};
}
