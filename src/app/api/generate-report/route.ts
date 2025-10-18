import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { qwenChat } from "@/clients/qwen-text";
import { recordLLMUsage } from "@/server/monitoring";
import { setCachedAudio } from "@/server/audio-cache";
import { getPrompt } from "@/server/prompt-service";

// 分块函数，与clean-transcript保持一致
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

const bodySchema = z.object({
	transcript: z.string().min(1),
	title: z.string().optional(),
	audioUrl: z.string().url().optional(), // 用于缓存
});

export async function POST(req: NextRequest) {
	const startTime = Date.now();
	
	try {
		const body = await req.json().catch(() => ({}));
		const parsed = bodySchema.safeParse(body);
		
		if (!parsed.success) {
			return jsonError("Invalid request body", 400);
		}
		
		const { transcript, title, audioUrl } = parsed.data;
		
		console.log(`开始生成访谈报告，文本长度: ${transcript.length} 字符`);
		
		// 根据文本长度动态调整分块策略
		const textLength = transcript.length;
		let chunkSize = 2000; // 块大小
		let overlap = 150;    // 重叠
		let batchSize = 3;    // 批处理大小
		
		if (textLength > 100000) { // 超长文本（2小时+）
			chunkSize = 1800;
			overlap = 120;
			batchSize = 4;
		} else if (textLength > 50000) { // 长文本（1小时+）
			chunkSize = 1900;
			overlap = 130;
			batchSize = 3;
		} else if (textLength > 20000) { // 中等文本
			chunkSize = 2000;
			overlap = 150;
			batchSize = 2;
		}
		
		console.log(`使用分块策略: 块大小=${chunkSize}, 重叠=${overlap}, 批处理=${batchSize}`);
		
		// 如果文本较短，直接生成报告
		if (textLength <= 8000) {
			const { summary } = await generateInterviewReportSimple(transcript, title);
			console.log(`访谈报告生成完成，总耗时: ${Date.now() - startTime}ms`);
			
			// 记录LLM API使用情况
			const estimatedTokens = Math.ceil((transcript.length + summary.length) / 2);
			await recordLLMUsage(estimatedTokens);
			
			// 缓存生成的报告
			if (audioUrl) {
				await setCachedAudio(audioUrl, { summary });
			}
			
			return Response.json({
				success: true,
				summary,
				stats: {
					originalLength: transcript.length,
					reportLength: summary.length,
					processingTime: Date.now() - startTime,
					estimatedTokens,
					method: "single"
				}
			});
		}
		
		// 长文本分块处理
		const chunks = splitByTokensApprox(transcript, chunkSize, overlap);
		console.log(`分块完成，共 ${chunks.length} 个块`);
		
		// 获取动态系统提示词
		let systemPrompt: string;
		try {
			systemPrompt = await getPrompt('report_generation_chunked');
		} catch (error) {
			console.warn('Failed to get dynamic prompt, using fallback:', error);
			// 回退到硬编码提示词
			systemPrompt = `你是专业的访谈报告撰写专家。请基于播客访谈内容，生成一份专业的访谈报告片段。

**重要限制：**
- **仅参考播客内容**：严格限制只使用提供的播客访谈内容，不得引用、参考或提及任何外部信息、资料、书籍、论文、网站或其他来源
- **禁止外部引用**：不得添加任何"参考资料来源"、"参考文献"或类似的外部信息引用
- **内容来源唯一**：所有观点、论据、案例都必须来自播客内容本身

**报告要求：**
1. **忽略说话人身份**：不要标注"主持人"、"嘉宾"等身份，直接呈现观点和内容
2. **保留核心内容**：必须保留至少60%以上的核心观点和论据
3. **专业格式**：采用学术报告或商业分析报告的格式
4. **结构化组织**：按主题和逻辑关系组织内容
5. **客观表达**：以第三人称客观视角呈现观点

**格式要求：**
- 适当使用项目符号（•）来组织要点，提高可读性
- 在列举多个观点、论据或案例时使用项目符号
- 项目符号不要过于频繁，主要用于关键信息的分组
- 保持内容的层次感和结构清晰

**输出要求：**
- 只输出这个片段的专业报告内容
- 保持逻辑清晰，突出核心观点
- 避免口语化表达
- 使用Markdown格式
- 不得包含任何外部引用或资料来源`;
		}

		// 分批处理各个片段
		const reportChunks: string[] = [];
		for (let i = 0; i < chunks.length; i += batchSize) {
			const batch = chunks.slice(i, i + batchSize);
			console.log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}: 块 ${i + 1}-${Math.min(i + batchSize, chunks.length)}`);
			
			const batchPromises = batch.map(async (chunk, idx) => {
				const chunkIndex = i + idx + 1;
				console.log(`  处理块 ${chunkIndex}: ${chunk.length} 字符`);
				
				// 重试机制
				for (let attempt = 1; attempt <= 3; attempt++) {
					try {
						const result = await qwenChat([
							{ role: "system", content: systemPrompt },
							{ role: "user", content: `请基于以下访谈内容片段生成专业报告：\n\n${chunk}` }
						], { maxTokens: 2500 });
						
						if (result && result.trim()) {
							console.log(`  块 ${chunkIndex} 处理成功`);
							return result.trim();
						} else {
							throw new Error("Empty result");
						}
					} catch (error: any) {
						console.error(`  块 ${chunkIndex} 第${attempt}次尝试失败:`, error.message);
						if (attempt < 3) {
							await new Promise(resolve => setTimeout(resolve, 500 * attempt));
						} else {
							console.error(`  块 ${chunkIndex} 最终失败，跳过`);
							return `[片段${chunkIndex}处理失败]`;
						}
					}
				}
				return `[片段${chunkIndex}处理失败]`;
			});
			
			const batchResults = await Promise.all(batchPromises);
			reportChunks.push(...batchResults);
		}
		
		// 合并所有片段并生成最终报告
		const combinedChunks = reportChunks.filter(chunk => !chunk.includes('处理失败')).join('\n\n');
		console.log(`片段合并完成，共 ${reportChunks.length} 个片段，有效片段 ${reportChunks.filter(chunk => !chunk.includes('处理失败')).length} 个`);
		
		// 生成最终整合报告
		const finalReport = await generateFinalReport(combinedChunks, title);
		
		console.log(`访谈报告生成完成，总耗时: ${Date.now() - startTime}ms`);
		
		// 记录LLM API使用情况
		const estimatedTokens = Math.ceil((transcript.length + finalReport.length) / 2);
		await recordLLMUsage(estimatedTokens);
		
		// 缓存生成的报告
		if (audioUrl) {
			await setCachedAudio(audioUrl, { summary: finalReport });
		}
		
		return Response.json({
			success: true,
			summary: finalReport,
			stats: {
				originalLength: transcript.length,
				reportLength: finalReport.length,
				processingTime: Date.now() - startTime,
				estimatedTokens,
				method: "chunked",
				chunksProcessed: chunks.length,
				validChunks: reportChunks.filter(chunk => !chunk.includes('处理失败')).length
			}
		});
		
	} catch (error: any) {
		console.error("访谈报告生成失败:", error);
		return jsonError(error?.message || "访谈报告生成失败", 500);
	}
}

// 简单报告生成函数（用于短文本）
async function generateInterviewReportSimple(transcript: string, title?: string): Promise<{ summary: string }> {
	// 获取动态系统提示词
	let systemPrompt: string;
	try {
		systemPrompt = await getPrompt('report_generation_simple');
	} catch (error) {
		console.warn('Failed to get dynamic prompt, using fallback:', error);
		// 回退到硬编码提示词
		systemPrompt = `你是专业的访谈报告撰写专家。请基于播客访谈内容，生成一份专业的访谈报告。

**重要限制：**
- **仅参考播客内容**：严格限制只使用提供的播客访谈内容，不得引用、参考或提及任何外部信息、资料、书籍、论文、网站或其他来源
- **禁止外部引用**：不得添加任何"参考资料来源"、"参考文献"或类似的外部信息引用
- **内容来源唯一**：所有观点、论据、案例都必须来自播客内容本身

**报告要求：**
1. **忽略说话人身份**：不要标注"主持人"、"嘉宾"等身份，直接呈现观点和内容
2. **保留核心内容**：必须保留至少60%以上的核心观点和论据
3. **专业格式**：采用学术报告或商业分析报告的格式
4. **结构化组织**：按主题和逻辑关系组织内容
5. **客观表达**：以第三人称客观视角呈现观点

**格式要求：**
- 适当使用项目符号（•）来组织要点，提高可读性
- 在列举多个观点、论据或案例时使用项目符号
- 项目符号不要过于频繁，主要用于关键信息的分组
- 保持内容的层次感和结构清晰

**报告结构：**
- 引言：简要概述访谈主题和背景
- 核心观点：按重要性列出主要观点
- 详细论述：对每个观点进行深入分析
- 案例与论据：提供具体的案例和数据支撑
- 结论：总结访谈的核心价值和启示

**写作风格：**
- 专业、客观、逻辑清晰
- 避免口语化表达
- 突出核心观点和论据
- 保持内容的完整性和准确性
- 不得包含任何外部引用或资料来源`;
	}

	const messages = [
		{
			role: "system" as const,
			content: systemPrompt
		},
		{
			role: "user" as const,
			content: `请基于以下播客访谈内容生成专业访谈报告：

**播客标题：** ${title || "访谈内容"}

**访谈内容：**
${transcript}

请生成一份专业的访谈报告，确保保留至少60%以上的核心观点和论据。`
		}
	];
	
	const report = await qwenChat(messages, { maxTokens: 3000 });
	return { summary: report };
}

// 最终报告整合函数
async function generateFinalReport(combinedChunks: string, title?: string): Promise<string> {
	// 获取动态系统提示词
	let systemPrompt: string;
	try {
		systemPrompt = await getPrompt('final_integration');
	} catch (error) {
		console.warn('Failed to get dynamic prompt, using fallback:', error);
		// 回退到硬编码提示词
		systemPrompt = `你是专业的播客内容整合与报告撰写专家。
请根据提供的播客逐字稿，生成一份完整、连贯、专业的播客报告。
目标是将播客中讨论的思想、观点和论据系统化、结构化地呈现，使报告可独立阅读与理解。

**重要限制：**

**仅参考播客内容**：严格限制只使用提供的播客内容，不得引用、参考或提及任何外部信息、资料、书籍、论文、网站或其他来源。

**禁止外部引用**：不得添加任何"参考资料"、"参考文献"或类似的外部信息引用。

**内容来源唯一**：所有观点、论据、案例都必须来自播客内容本身。

**整合要求：**

**保持专业性**：语言正式、客观、逻辑清晰，避免口语化。

**逻辑连贯**：合并重复内容，确保自然衔接与结构流畅。

**结构完整**：按照报告格式组织内容，但可根据播客类型灵活调整。

**内容完整**：保留播客中的所有核心观点与主要论据。

**格式统一**：使用一致的 Markdown 标题与分点结构。

**严禁外部引用**：报告中不得出现任何外部资料或拓展内容。

**格式要求：**
- 适当使用项目符号（•）来组织要点，提高可读性
- 在列举多个观点、论据或案例时使用项目符号
- 项目符号不要过于频繁，主要用于关键信息的分组
- 保持内容的层次感和结构清晰

**报告结构：**

**引言**：概述播客主题、背景与主要议题（仅基于播客内容）。

**核心观点与支撑**：
- 将每个主要观点与其论述、论据整合为独立段落。
- 每个段落遵循"观点 → 说明 → 来自播客的支撑或例证"的逻辑。
- 可使用小标题或编号（如"观点一：…"、"观点二：…"）。
- 若为多人访谈，可分别呈现各发言人的主要观点及论据。

**总结与启示**：
- 提炼播客的核心洞见与讨论价值。
- 说明本期内容在主题领域中的意义与启发。
- 不得添加外部分析或推论。

**篇幅与语言要求：**

**报告篇幅**为原播客逐字稿长度的 50%–60%，浓缩但完整。

**删除口头语、冗余句、重复信息与闲聊内容**。

**使用正式、清晰、逻辑性强的书面语**。

**可使用小标题与分点结构提高可读性，但保持简洁**。

**输出格式：**

**使用标准 Markdown 标题层级**（#、##、###）组织结构。

**不含任何外部引用、参考链接或附录**。

**报告应可直接作为独立文档展示或导出使用**。`;
	}

	const messages = [
		{
			role: "system" as const,
			content: systemPrompt
		},
		{
			role: "user" as const,
			content: `请将以下访谈报告片段整合成一份完整、连贯的专业访谈报告：

**播客标题：** ${title || "访谈内容"}

**报告片段：**
${combinedChunks}

请生成一份完整、专业的访谈报告，确保内容连贯、逻辑清晰。`
		}
	];
	
	return await qwenChat(messages, { maxTokens: 3000 });
}
