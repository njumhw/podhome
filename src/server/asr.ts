import { env } from "@/utils/env";

// 阿里云ASR服务配置
const ASR_CONFIG = {
	// 阿里云ASR API配置
	region: 'cn-shanghai', // 根据你的服务区域调整
	endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com',
	version: '2019-02-28',
	
	// 音频限制
	maxDuration: 170, // 2分50秒（留10秒安全边际）
	maxFileSize: 10 * 1024 * 1024, // 10MB
	supportedFormats: ['m4a', 'mp3', 'wav', 'aac'],
	
	// 转写参数
	enablePunctuation: true,
	enableWordTime: true,
	enableSpeakerDiarization: true, // 说话人分离
};

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
 */
export async function transcribeWithAliyunASR(audioUrl: string): Promise<ASRResult> {
	try {
		// 检查环境变量
		if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET) {
			throw new Error('阿里云ASR配置缺失');
		}
		
		// 这里应该实现真实的阿里云ASR API调用
		// 暂时返回模拟结果
		return await mockASRTranscription(audioUrl);
		
	} catch (error: any) {
		return {
			success: false,
			transcript: '',
			speakers: [],
			duration: 0,
			error: error.message
		};
	}
}

/**
 * 模拟ASR转写（用于测试）
 */
async function mockASRTranscription(audioUrl: string): Promise<ASRResult> {
	// 模拟处理时间
	await new Promise(resolve => setTimeout(resolve, 2000));
	
	// 模拟转写结果
	return {
		success: true,
		transcript: `这是从 ${audioUrl} 转写的模拟文本内容。在实际实现中，这里应该是阿里云ASR返回的真实转写结果。`,
		speakers: [
			{
				speaker: 'Speaker1',
				startTime: 0,
				endTime: 30,
				text: '这是Speaker1的发言内容。'
			},
			{
				speaker: 'Speaker2', 
				startTime: 30,
				endTime: 60,
				text: '这是Speaker2的回复内容。'
			}
		],
		duration: 60
	};
}

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
