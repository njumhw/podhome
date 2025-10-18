// 质量保证和验证机制
import { db } from "@/server/db";

export interface ProcessingResult {
	transcript?: string;
	script?: string;
	summary?: string;
	report?: string;
	metadata?: any;
}

export interface QualityMetrics {
	completeness: number; // 完整性 (0-1)
	consistency: number;  // 一致性 (0-1)
	accuracy: number;     // 准确性 (0-1)
	overall: number;      // 总体质量 (0-1)
}

/**
 * 验证处理结果的完整性
 */
export function validateProcessingResult(original: any, processed: ProcessingResult): boolean {
	const requiredFields = ['transcript', 'script', 'summary'];
	const missingFields: string[] = [];
	
	for (const field of requiredFields) {
		if (!processed[field as keyof ProcessingResult] || 
			(processed[field as keyof ProcessingResult] as string).length === 0) {
			missingFields.push(field);
		}
	}
	
	if (missingFields.length > 0) {
		console.error(`处理结果缺少必要字段: ${missingFields.join(', ')}`);
		return false;
	}
	
	// 验证内容长度
	if (processed.transcript && original.transcript) {
		const lengthRatio = processed.transcript.length / original.transcript.length;
		if (lengthRatio < 0.5) {
			console.warn(`转写文本长度异常: 处理后长度仅为原始的 ${(lengthRatio * 100).toFixed(1)}%`);
		}
	}
	
	return true;
}

/**
 * 计算质量指标
 */
export function calculateQualityMetrics(original: any, processed: ProcessingResult): QualityMetrics {
	let completeness = 0;
	let consistency = 0;
	let accuracy = 0;
	
	// 1. 完整性检查
	const requiredFields = ['transcript', 'script', 'summary'];
	const presentFields = requiredFields.filter(field => 
		processed[field as keyof ProcessingResult] && 
		(processed[field as keyof ProcessingResult] as string).length > 0
	);
	completeness = presentFields.length / requiredFields.length;
	
	// 2. 一致性检查
	if (processed.transcript && processed.script) {
		// 检查说话人标注的一致性
		const transcriptSpeakers = extractSpeakers(processed.transcript);
		const scriptSpeakers = extractSpeakers(processed.script);
		
		const commonSpeakers = transcriptSpeakers.filter(s => scriptSpeakers.includes(s));
		consistency = commonSpeakers.length / Math.max(transcriptSpeakers.length, scriptSpeakers.length);
	} else {
		consistency = 0.5; // 默认中等一致性
	}
	
	// 3. 准确性检查（基于内容长度和结构）
	if (processed.transcript && original.transcript) {
		const lengthRatio = processed.transcript.length / original.transcript.length;
		// 理想长度比例应该在0.8-1.2之间
		accuracy = Math.max(0, 1 - Math.abs(lengthRatio - 1) * 2);
	} else {
		accuracy = 0.5; // 默认中等准确性
	}
	
	// 4. 总体质量
	const overall = (completeness + consistency + accuracy) / 3;
	
	return {
		completeness,
		consistency,
		accuracy,
		overall
	};
}

/**
 * 提取说话人列表
 */
function extractSpeakers(text: string): string[] {
	const speakerPattern = /(?:说话人|主持人|嘉宾)[A-Z]?[（(]?([^）)]*)[）)]?/g;
	const speakers = new Set<string>();
	let match;
	
	while ((match = speakerPattern.exec(text)) !== null) {
		const speaker = match[1]?.trim() || match[0];
		if (speaker) {
			speakers.add(speaker);
		}
	}
	
	return Array.from(speakers);
}

/**
 * 比较处理结果
 */
export async function compareProcessingResults(
	originalMethod: () => Promise<ProcessingResult>,
	optimizedMethod: () => Promise<ProcessingResult>
): Promise<{
	isEquivalent: boolean;
	differences: string[];
	qualityMetrics: {
		original: QualityMetrics;
		optimized: QualityMetrics;
	};
}> {
	const [original, optimized] = await Promise.all([
		originalMethod(),
		optimizedMethod()
	]);
	
	const differences: string[] = [];
	
	// 比较关键字段
	if (original.transcript !== optimized.transcript) {
		differences.push('Transcript content differs');
	}
	
	if (original.script !== optimized.script) {
		differences.push('Script content differs');
	}
	
	if (original.summary !== optimized.summary) {
		differences.push('Summary content differs');
	}
	
	// 计算质量指标
	const originalMetrics = calculateQualityMetrics({}, original);
	const optimizedMetrics = calculateQualityMetrics({}, optimized);
	
	return {
		isEquivalent: differences.length === 0,
		differences,
		qualityMetrics: {
			original: originalMetrics,
			optimized: optimizedMetrics
		}
	};
}

/**
 * 安全优化处理（带回退机制）
 */
export async function safeOptimizedProcessing(
	optimizedMethod: () => Promise<ProcessingResult>,
	fallbackMethod: () => Promise<ProcessingResult>,
	originalData?: any
): Promise<ProcessingResult> {
	try {
		const result = await optimizedMethod();
		
		// 验证结果质量
		if (originalData && !validateProcessingResult(originalData, result)) {
			console.warn('优化处理结果质量检查失败，回退到原始方法');
			return await fallbackMethod();
		}
		
		// 计算质量指标
		const metrics = calculateQualityMetrics(originalData || {}, result);
		console.log(`处理质量指标: 完整性=${(metrics.completeness * 100).toFixed(1)}%, 一致性=${(metrics.consistency * 100).toFixed(1)}%, 准确性=${(metrics.accuracy * 100).toFixed(1)}%, 总体=${(metrics.overall * 100).toFixed(1)}%`);
		
		// 如果总体质量低于阈值，回退到原始方法
		if (metrics.overall < 0.7) {
			console.warn(`处理质量过低 (${(metrics.overall * 100).toFixed(1)}%)，回退到原始方法`);
			return await fallbackMethod();
		}
		
		return result;
	} catch (error) {
		console.warn('优化处理失败，回退到原始方法:', error);
		return await fallbackMethod();
	}
}

/**
 * 记录质量指标到数据库
 */
export async function recordQualityMetrics(
	podcastId: string,
	metrics: QualityMetrics,
	processingTime: number
): Promise<void> {
	try {
		await db.qualityLog.create({
			data: {
				podcastId,
				completeness: metrics.completeness,
				consistency: metrics.consistency,
				accuracy: metrics.accuracy,
				overall: metrics.overall,
				processingTime,
				createdAt: new Date()
			}
		});
	} catch (error) {
		console.warn('记录质量指标失败:', error);
	}
}

/**
 * 获取质量统计信息
 */
export async function getQualityStats(days: number = 7): Promise<{
	averageQuality: number;
	totalProcessed: number;
	qualityDistribution: {
		excellent: number; // > 0.9
		good: number;      // 0.7-0.9
		fair: number;      // 0.5-0.7
		poor: number;      // < 0.5
	};
}> {
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	
	const logs = await db.qualityLog.findMany({
		where: {
			createdAt: {
				gte: since
			}
		},
		select: {
			overall: true
		}
	});
	
	const totalProcessed = logs.length;
	const averageQuality = totalProcessed > 0 
		? logs.reduce((sum, log) => sum + log.overall, 0) / totalProcessed 
		: 0;
	
	const qualityDistribution = {
		excellent: logs.filter(log => log.overall > 0.9).length,
		good: logs.filter(log => log.overall >= 0.7 && log.overall <= 0.9).length,
		fair: logs.filter(log => log.overall >= 0.5 && log.overall < 0.7).length,
		poor: logs.filter(log => log.overall < 0.5).length
	};
	
	return {
		averageQuality,
		totalProcessed,
		qualityDistribution
	};
}
