import { NextRequest } from "next/server";
import { qwenChat } from "@/clients/qwen-text";
import { recordLLMUsage } from "@/server/monitoring";
import { setCachedAudio } from "@/server/audio-cache";
import { getPrompt } from "@/server/prompt-service";

function jsonError(message: string, status = 400) {
	return new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });
}

function splitByTokensApprox(text: string, targetTokens = 3000, overlapTokens = 250): string[] {
	// 近似：按字符数估算 tokens（中文更接近1:1，英文约4:1，这里简化处理）。
	const approxTokenPerChar = 1; // 保守估计
	const chunkChars = Math.max(1000, Math.floor(targetTokens / approxTokenPerChar));
	const overlapChars = Math.floor(overlapTokens / approxTokenPerChar);
	const chunks: string[] = [];
	let i = 0;
	while (i < text.length) {
		const end = Math.min(text.length, i + chunkChars);
		const slice = text.slice(i, end);
		chunks.push(slice);
		if (end >= text.length) break;
		i = end - overlapChars;
		if (i < 0) i = 0;
	}
	return chunks;
}

// 批量处理文本优化函数
async function batchProcessText<T>(
	items: T[], 
	processor: (item: T, index: number) => Promise<string>, 
	batchSize: number = 3
): Promise<string[]> {
	const results: string[] = [];
	
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		const batchNumber = Math.floor(i / batchSize) + 1;
		const totalBatches = Math.ceil(items.length / batchSize);
		
		console.log(`处理批次 ${batchNumber}/${totalBatches}: 项目 ${i + 1}-${Math.min(i + batchSize, items.length)}`);
		
		const batchPromises = batch.map(async (item, idx) => {
			const globalIndex = i + idx;
			return await processor(item, globalIndex);
		});
		
		const batchResults = await Promise.all(batchPromises);
		results.push(...batchResults);
		
		console.log(`批次 ${batchNumber} 完成`);
	}
	
	return results;
}

export async function generateScript(transcript: string, language: string = "zh", audioUrl?: string) {
    const startTime = Date.now();
    try {
        if (!transcript.trim()) throw new Error("缺少 transcript");

		console.log(`开始处理讲稿生成，原始文本长度: ${transcript.length} 字符`);

		// 根据文本长度动态调整分块策略 - 针对长音频优化
		const textLength = transcript.length;
		let chunkSize = 2000; // 增大块大小，减少API调用次数
		let overlap = 150;    // 适当重叠，保证连续性
		let batchSize = 4;    // 保守设置，避免超过API限制

		if (textLength > 100000) { // 超长文本（2小时+）
			chunkSize = 1800;
			overlap = 120;
			batchSize = 5; // 保守并行
		} else if (textLength > 50000) { // 长文本（1小时+）
			chunkSize = 1900;
			overlap = 130;
			batchSize = 4;
		} else if (textLength > 20000) { // 中等文本
			chunkSize = 2000;
			overlap = 150;
			batchSize = 3;
		}

		console.log(`使用分块策略: 块大小=${chunkSize}, 重叠=${overlap}, 批处理=${batchSize}`);

		const chunks = splitByTokensApprox(transcript, chunkSize, overlap);
		console.log(`分块完成，共 ${chunks.length} 个块`);

        // 获取动态系统提示词
        let systemPrompt: string;
        try {
            systemPrompt = await getPrompt('transcript_cleaning');
        } catch (error) {
            console.warn('Failed to get dynamic prompt, using fallback:', error);
            // 回退到硬编码提示词
            systemPrompt = "你是播客文案编辑。将口语化转写清洗为专业播客讲稿：删赘词口头禅、重写断句与转场、统一术语与人称，不改变事实，保证信息密度与逻辑。\n\n【说话人识别与标注优先级】\n1) 优先判断角色：主持人/嘉宾（若能判断具体姓名，请在括号中写姓名；如\"主持人（任川）\"、\"嘉宾（王小明）\"）。\n2) 若无法判断具体姓名，则仅写角色；再无法判断时使用说话人A/B/C。\n3) 全文保持同一人的标签稳定一致。\n\n【统一输出风格】\n- 使用Markdown列表格式，每段发言前加 - 符号；\n- 格式：- **说话人X（角色或姓名，可留空）：** 内容；\n- 说话人名称使用粗体，便于前端渲染时区分；\n- 语言自然、逻辑清晰，但不改事实。";
        }

        const system = {
			role: "system" as const,
			content: systemPrompt,
		};

		// 优化后的批量处理，提高并行度和错误处理
		const cleaned: string[] = await batchProcessText(chunks, async (chunk, index) => {
			console.log(`  处理块 ${index + 1}: ${chunk.length} 字符`);
			
			// 重试机制：最多重试3次
			let lastError: any = null;
			for (let attempt = 1; attempt <= 3; attempt++) {
				try {
					const result = await qwenChat([
						system,
						{ role: "user", content: `请清洗以下片段，删除赘词与口头禅，重写断句与转场，统一术语与人称，不改变事实。\n\n识别规则：\n- 优先识别主持人/嘉宾，并尽量在括号中填入可识别的姓名；\n- 若无法判断姓名，仅写主持人/嘉宾；再无法判断用说话人A/B/C；\n- 全文保持同一人的标签稳定一致。\n\n输出格式：\n- 使用Markdown列表格式：- **说话人X（角色或姓名）：** 内容\n- 说话人名称使用粗体\n- 适当使用项目符号（•）来组织要点，提高可读性\n- 在列举多个观点、论据或案例时使用项目符号\n- 项目符号不要过于频繁，主要用于关键信息的分组\n\n转写内容：\n${chunk}` },
					], { model: "qwen-plus", temperature: 0.3, maxTokens: 6000 }); // 增加输出限制，确保内容完整性
					
					// 验证结果
					if (!result || result.trim().length === 0) {
						throw new Error(`清洗结果为空 (尝试 ${attempt}/3)`);
					}
					
					console.log(`  块 ${index + 1} 处理成功 (尝试 ${attempt}/3)`);
					return result;
				} catch (error: any) {
					lastError = error;
					console.warn(`  块 ${index + 1} 处理失败 (尝试 ${attempt}/3):`, error.message);
					
					if (attempt < 3) {
						// 指数退避重试
						await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
					}
				}
			}
			
			// 所有重试都失败了，返回原始文本
			console.error(`  块 ${index + 1} 处理失败，使用原始文本`);
			return chunk;
		}, batchSize);

		// 去重处理：移除重复的段落和句子
		function deduplicateText(text: string): string {
			const paragraphs = text.split("\n\n").filter(p => p.trim());
			const seen = new Set<string>();
			const unique: string[] = [];
			
			for (const para of paragraphs) {
				// 标准化段落内容（去除多余空格，统一标点）
				const normalized = para.trim().replace(/\s+/g, " ");
				if (!seen.has(normalized) && normalized.length > 10) {
					seen.add(normalized);
					unique.push(para);
				}
			}
			
			return unique.join("\n\n");
		}

		const initialDraft = deduplicateText(cleaned.join("\n\n"));
		console.log(`初步清洗完成，去重后长度: ${initialDraft.length} 字符`);

        // 总润色：使用更保守的策略，确保完整性，增加重试机制
		let finalText = "";
		if (initialDraft.length > 6000) { // 降低阈值，更早开始分块
			console.log("开始分块总润色...");
			const refineChunks = splitByTokensApprox(initialDraft, 2500, 150); // 更小的块
			console.log(`总润色分块: ${refineChunks.length} 个块`);
			
			// 串行处理总润色，确保稳定性，增加重试机制
			const refinedPieces: string[] = [];
			for (let i = 0; i < refineChunks.length; i++) {
				console.log(`  润色块 ${i + 1}/${refineChunks.length}: ${refineChunks[i].length} 字符`);
				
				// 重试机制：最多重试3次
				let lastError: any = null;
				let refined = "";
				for (let attempt = 1; attempt <= 3; attempt++) {
					try {
                        refined = await qwenChat([
							system,
                            { role: "user", content: `请在不改变事实的前提下统一风格与转场，保持说话人标注格式，输出这一段的最终讲稿。\n\n严格输出规则（必须遵守）：\n- 使用Markdown列表格式：- **说话人X（角色，可留空）：** 内容\n- 说话人名称使用粗体，便于前端渲染\n- 若无法识别角色，留空括号，如：- **说话人A（）：** 内容\n\n内容：\n${refineChunks[i]}` },
						], { model: "qwen-plus", temperature: 0.3, maxTokens: 2000 });
						
						// 验证结果
						if (!refined || refined.trim().length === 0) {
							throw new Error(`润色结果为空 (尝试 ${attempt}/3)`);
						}
						
						console.log(`  润色块 ${i + 1} 成功 (尝试 ${attempt}/3)`);
						break;
					} catch (error: any) {
						lastError = error;
						console.warn(`  润色块 ${i + 1} 失败 (尝试 ${attempt}/3):`, error.message);
						
						if (attempt < 3) {
							// 减少等待时间，提高处理速度
							await new Promise(resolve => setTimeout(resolve, 500 * attempt));
						}
					}
				}
				
				// 如果所有重试都失败了，使用原始文本
				if (!refined || refined.trim().length === 0) {
					console.error(`  润色块 ${i + 1} 失败，使用原始文本`);
					refined = refineChunks[i];
				}
				
				refinedPieces.push(refined);
			}
			
			finalText = refinedPieces.join("\n\n");
			console.log(`分块润色完成，长度: ${finalText.length} 字符`);
		} else {
            console.log("开始单次总润色...");
			
			// 重试机制：最多重试3次
			let lastError: any = null;
			for (let attempt = 1; attempt <= 3; attempt++) {
				try {
                    finalText = await qwenChat([
						system,
                        { role: "user", content: `请在不改变事实的前提下统一风格与转场，保持说话人标注格式，输出最终讲稿。\n\n严格输出规则（必须遵守）：\n- 使用Markdown列表格式：- **说话人X（角色，可留空）：** 内容\n- 说话人名称使用粗体，便于前端渲染\n- 若无法识别角色，留空括号，如：- **说话人A（）：** 内容\n\n内容：\n${initialDraft}` },
					], { model: "qwen-plus", temperature: 0.3, maxTokens: 2000 });
					
					// 验证结果
					if (!finalText || finalText.trim().length === 0) {
						throw new Error(`润色结果为空 (尝试 ${attempt}/3)`);
					}
					
					console.log(`单次润色成功 (尝试 ${attempt}/3)，最终长度: ${finalText.length} 字符`);
					break;
				} catch (error: any) {
					lastError = error;
					console.warn(`单次润色失败 (尝试 ${attempt}/3):`, error.message);
					
					if (attempt < 3) {
						// 等待后重试
						await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
					}
				}
			}
			
			// 如果所有重试都失败了，使用初步清洗的结果
			if (!finalText || finalText.trim().length === 0) {
				console.error("单次润色失败，使用初步清洗结果");
				finalText = initialDraft;
			}
		}

        // 统一后处理：保留Markdown格式，确保每行都有列表符号
        function normalizeSpeakerFormatting(text: string): string {
            let t = text;
            // 去掉所有成对的 ** 粗体标记
            t = t.replace(/\*\*(.*?)\*\*/g, "$1");
            // 将英文冒号替换为中文冒号
            t = t.replace(/:\s/g, "：");
            // 保留列表符号，确保每行都有 - 符号
            t = t.replace(/^\s*[-•]\s*/gm, "- ");
            // 去除行首引号与多余空格
            t = t
                .split(/\n+/)
                .map(line => line
                    .replace(/^\s*["“]+/, "")
                    .replace(/["”]+\s*$/, "")
                    .replace(/^\s*(说话人|主持人|嘉宾)/, match => `${match}`)
                )
                .join("\n");
            return t;
        }

        finalText = normalizeSpeakerFormatting(finalText);
        console.log(`讲稿生成完成，总耗时: ${Date.now() - startTime}ms`);

        // 记录LLM API使用情况（估算tokens）
        const estimatedTokens = Math.ceil((transcript.length + finalText.length) / 2); // 粗略估算
        await recordLLMUsage(estimatedTokens);

        // 缓存生成的讲稿（如果有audioUrl参数）
        if (audioUrl) {
            await setCachedAudio(audioUrl, {
                script: finalText
            });
        }

        return {
            success: true,
            script: finalText,
            cleaned: initialDraft,
            stats: {
                originalLength: transcript.length,
                finalLength: finalText.length,
                chunksProcessed: chunks.length,
                processingTime: Date.now() - startTime
            }
        };
	} catch (error: any) {
        console.error("讲稿生成失败:", error);
        throw new Error(error?.message || String(error));
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const transcript: string = (body?.transcript ?? "").toString();
        const language: string = body?.language || "zh";
        const audioUrl: string | undefined = body?.audioUrl || undefined;
        const result = await generateScript(transcript, language, audioUrl);
        return Response.json(result);
    } catch (error: any) {
        console.error("讲稿生成失败:", error);
        return jsonError(`讲稿生成失败: ${error?.message || error}`, 500);
	}
}