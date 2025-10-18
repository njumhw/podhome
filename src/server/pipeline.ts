import { db } from "@/server/db";
import { transcribeFromUrl } from "@/clients/aliyun-asr";
import { cleanTranscript, summarize, identifySpeakers } from "@/clients/qwen-text";
import { embedText } from "@/clients/qwen-embedding";
import { ensureVectorSetup } from "@/server/vector";
import { 
	validateProcessingResult, 
	calculateQualityMetrics, 
	recordQualityMetrics,
	type ProcessingResult 
} from "@/server/quality-assurance";

// 动态并发控制器
class DynamicConcurrencyController {
	private maxConcurrency = 5;
	private currentLoad = 0;
	private readonly minConcurrency = 2;
	private readonly maxConcurrencyLimit = 8;
	
	async adjustConcurrency(): Promise<void> {
		// 模拟系统负载检测（实际应用中可以从系统指标获取）
		const systemLoad = await this.getSystemLoad();
		
		if (systemLoad < 0.5) {
			// 系统负载低，可以增加并发
			this.maxConcurrency = Math.min(this.maxConcurrencyLimit, this.maxConcurrency + 1);
		} else if (systemLoad > 0.8) {
			// 系统负载高，减少并发
			this.maxConcurrency = Math.max(this.minConcurrency, this.maxConcurrency - 1);
		}
		
		console.log(`动态调整并发度: ${this.maxConcurrency} (系统负载: ${(systemLoad * 100).toFixed(1)}%)`);
	}
	
	private async getSystemLoad(): Promise<number> {
		// 简化的负载检测：基于当前活跃任务数量
		const activeTasks = await db.taskLog.count({
			where: {
				status: "RUNNING",
				createdAt: {
					gte: new Date(Date.now() - 5 * 60 * 1000) // 最近5分钟
				}
			}
		});
		
		// 将活跃任务数转换为负载百分比
		return Math.min(1, activeTasks / 10);
	}
	
	getMaxConcurrency(): number {
		return this.maxConcurrency;
	}
}

// 全局并发控制器实例
const concurrencyController = new DynamicConcurrencyController();

async function withTask<T>(podcastId: string, type: "TRANSCRIBE"|"CLEAN"|"IDENTIFY"|"SUMMARIZE"|"CHUNK"|"EMBED", fn: () => Promise<T>): Promise<T> {
	const started = Date.now();
	const log = await db.taskLog.create({ data: { podcastId, type, status: "RUNNING" } });
	try {
		const result = await fn();
		await db.taskLog.update({ where: { id: log.id }, data: { status: "SUCCESS", durationMs: Date.now() - started } });
		return result;
	} catch (err: any) {
		await db.taskLog.update({ where: { id: log.id }, data: { status: "FAILED", durationMs: Date.now() - started, error: String(err?.message ?? err) } });
		throw err;
	}
}

// 智能分块优化：保持重叠的同时提升效率
function smartChunk(text: string): { startSec: number; endSec: number; text: string }[] {
	const sentences = text.split(/(?<=[。！？.!?])\s*/);
	const chunks: { text: string; startIndex: number; endIndex: number }[] = [];
	
	let currentChunk = "";
	let startIndex = 0;
	const targetChunkSize = 800;
	const overlapSize = 150; // 保持重叠
	
	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i];
		const potentialChunk = currentChunk + (currentChunk ? " " : "") + sentence;
		
		if (potentialChunk.length > targetChunkSize && currentChunk.length > 0) {
			// 当前块已满，保存并开始新块
			chunks.push({
				text: currentChunk,
				startIndex,
				endIndex: i - 1
			});
			
			// 智能重叠：从当前句子的前几个句子开始新块
			const overlapSentences = Math.min(3, Math.floor(overlapSize / 50)); // 估算重叠句子数
			const overlapStart = Math.max(0, i - overlapSentences);
			
			currentChunk = sentences.slice(overlapStart, i).join(" ");
			startIndex = overlapStart;
		} else {
			currentChunk = potentialChunk;
		}
	}
	
	// 添加最后一个块
	if (currentChunk.length > 0) {
		chunks.push({
			text: currentChunk,
			startIndex,
			endIndex: sentences.length - 1
		});
	}
	
	// 转换为最终格式，包含时间戳
	return chunks.map((chunk, i) => ({
		startSec: i * 30,
		endSec: i * 30 + 30,
		text: chunk.text,
		// 保留重叠信息用于质量验证
		overlapInfo: {
			startIndex: chunk.startIndex,
			endIndex: chunk.endIndex,
			hasOverlap: i > 0 && chunk.startIndex < chunks[i - 1].endIndex
		}
	}));
}

// 兼容性函数，保持原有接口
function naiveChunk(text: string): { startSec: number; endSec: number; text: string }[] {
	return smartChunk(text).map(chunk => ({
		startSec: chunk.startSec,
		endSec: chunk.endSec,
		text: chunk.text
	}));
}

export async function runPipeline(podcastId: string) {
	const startTime = Date.now();
	
	// 动态调整并发度
	await concurrencyController.adjustConcurrency();
	
	const p = await db.podcast.findUnique({ where: { id: podcastId } });
	if (!p) throw new Error("Podcast not found");
	if (!p.sourceUrl) throw new Error("Missing sourceUrl");

	const audioUrl = p.audioUrl ?? p.sourceUrl;

	// 步骤1: ASR转写（必须串行，因为后续步骤依赖此结果）
	const asr = await withTask(podcastId, "TRANSCRIBE", async () => transcribeFromUrl(audioUrl));
	const rawTranscript = asr.segments.map(s => `${s.speaker ?? "Speaker"}:${s.text}`).join("\n");
	
	// 保存原始转写结果
	await db.podcast.update({ 
		where: { id: podcastId }, 
		data: { originalTranscript: rawTranscript } 
	});

	// 步骤2: 并行处理文本清洗和说话人识别
	// 注意：说话人识别需要依赖清洗后的文本，所以这里需要先清洗
	const cleaned = await withTask(podcastId, "CLEAN", async () => {
		const { cleaned } = await cleanTranscript({ raw: rawTranscript });
		return cleaned;
	});

	// 步骤3: 说话人识别（依赖清洗后的文本）
	const withSpeakers = await withTask(podcastId, "IDENTIFY", async () => {
		return await identifySpeakers(cleaned);
	});

	// 步骤4: 并行处理总结生成和分块
	const [summary, chunks] = await Promise.all([
		withTask(podcastId, "SUMMARIZE", async () => {
			const { summary } = await summarize({ text: withSpeakers });
			return summary;
		}),
		withTask(podcastId, "CHUNK", async () => naiveChunk(withSpeakers))
	]);

	// 步骤5: 批量数据库操作优化
	await db.podcast.update({ 
		where: { id: podcastId }, 
		data: { 
			transcript: withSpeakers, 
			summary, 
			status: "READY",
			processingCompletedAt: new Date()
		} 
	});

	// 批量处理分块数据
	await batchDatabaseOperations(podcastId, chunks);

	// 步骤6: 向量化处理
	await ensureVectorSetup();
	await withTask(podcastId, "EMBED", async () => {
		const rows = await db.transcriptChunk.findMany({ where: { podcastId }, select: { id: true, text: true } });
		for (const r of rows) {
			const { vector } = await embedText(r.text);
			await db.$executeRawUnsafe(`UPDATE "TranscriptChunk" SET embedding = $1 WHERE id = $2`, vector as any, r.id);
		}
	});

	// 步骤7: 质量保证和记录
	const processingTime = Date.now() - startTime;
	const processingResult: ProcessingResult = {
		transcript: withSpeakers,
		script: withSpeakers, // 在这个pipeline中，script和transcript是相同的
		summary: summary,
		metadata: {
			audioUrl,
			originalTranscript: rawTranscript,
			chunksCount: chunks.length
		}
	};

	// 验证处理结果
	if (!validateProcessingResult({ transcript: rawTranscript }, processingResult)) {
		console.error(`播客 ${podcastId} 处理结果验证失败`);
		throw new Error("处理结果验证失败");
	}

	// 计算质量指标
	const qualityMetrics = calculateQualityMetrics({ transcript: rawTranscript }, processingResult);
	console.log(`播客 ${podcastId} 质量指标:`, {
		完整性: `${(qualityMetrics.completeness * 100).toFixed(1)}%`,
		一致性: `${(qualityMetrics.consistency * 100).toFixed(1)}%`,
		准确性: `${(qualityMetrics.accuracy * 100).toFixed(1)}%`,
		总体: `${(qualityMetrics.overall * 100).toFixed(1)}%`
	});

	// 记录质量指标
	await recordQualityMetrics(podcastId, qualityMetrics, processingTime);

	console.log(`播客 ${podcastId} 处理完成，总耗时: ${processingTime}ms`);
}

// 批量数据库操作优化
async function batchDatabaseOperations(podcastId: string, chunks: { startSec: number; endSec: number; text: string }[]) {
	await db.$transaction(async (tx) => {
		// 批量删除
		await tx.transcriptChunk.deleteMany({ where: { podcastId } });
		
		// 批量创建
		await tx.transcriptChunk.createMany({
			data: chunks.map(c => ({
				podcastId,
				startSec: c.startSec,
				endSec: c.endSec,
				text: c.text
			}))
		});
	});
}
