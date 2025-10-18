import { getEnv } from "@/utils/env";
import { getPrompt } from "@/server/prompt-service";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function qwenChat(messages: ChatMessage[], options?: { model?: string; temperature?: number; maxTokens?: number }): Promise<string> {
	const env = getEnv();
	const apiKey = (env.QWEN_API_KEY as string) || "";
	if (!apiKey) throw new Error("Missing QWEN_API_KEY in env");

	const model = options?.model || "qwen-plus";
	const temperature = options?.temperature ?? 0.3;
	const max_tokens = options?.maxTokens ?? 800;

	const baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
	const endpoint = `${baseUrl}/chat/completions`;

	const body = {
		model,
		messages,
		temperature,
		max_tokens,
	};

	const res = await fetch(endpoint, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(body),
	});

	const text = await res.text();
	let data: any = {};
	try { data = JSON.parse(text); } catch {}
	if (!res.ok) {
		console.error("qwenChat error:", { status: res.status, body: text });
		throw new Error(data?.error?.message || data?.message || `chat failed(${res.status})`);
	}

	const content: string = data?.choices?.[0]?.message?.content ?? "";
	return typeof content === "string" ? content : "";
}

export type CleanTranscriptInput = { raw: string };
export type CleanTranscriptOutput = { cleaned: string };

export async function cleanTranscript(input: CleanTranscriptInput): Promise<CleanTranscriptOutput> {
	const messages: ChatMessage[] = [
		{
			role: "system",
			content: `你是播客文案编辑。将口语化转写清洗为专业播客讲稿：删赘词口头禅、重写断句与转场、统一术语与人称，不改变事实，保证信息密度与逻辑。

**格式要求：**
- 适当使用项目符号（•）来组织要点，提高可读性
- 在列举多个观点、论据或案例时使用项目符号
- 项目符号不要过于频繁，主要用于关键信息的分组
- 保持内容的层次感和结构清晰`
		},
		{
			role: "user", 
			content: `请清洗以下转写内容：\n\n${input.raw}`
		}
	];
	
	const cleaned = await qwenChat(messages, { maxTokens: 2000 });
	return { cleaned };
}

export type SummarizeInput = { text: string };
export type SummarizeOutput = { summary: string };

export async function summarize(input: SummarizeInput): Promise<SummarizeOutput> {
	// 获取动态系统提示词
	let systemPrompt: string;
	try {
		systemPrompt = await getPrompt('content_summarization');
	} catch (error) {
		console.warn('Failed to get dynamic prompt, using fallback:', error);
		// 回退到硬编码提示词
		systemPrompt = `你是播客内容总结专家。请为播客内容生成简洁、准确的总结，突出核心观点和关键信息。

**格式要求：**
- 适当使用项目符号（•）来组织要点，提高可读性
- 在列举多个观点、论据或案例时使用项目符号
- 项目符号不要过于频繁，主要用于关键信息的分组
- 保持内容的层次感和结构清晰

**总结要求：**
- 突出核心观点和关键信息
- 语言简洁明了
- 结构清晰，便于快速阅读
- 保留最重要的内容要点`;
	}

	const messages: ChatMessage[] = [
		{
			role: "system",
			content: systemPrompt
		},
		{
			role: "user",
			content: `请总结以下播客内容：\n\n${input.text}`
		}
	];
	
	const summary = await qwenChat(messages, { maxTokens: 1000 });
	return { summary };
}

export async function identifySpeakers(text: string): Promise<string> {
	// 获取动态系统提示词
	let systemPrompt: string;
	try {
		systemPrompt = await getPrompt('speaker_identification');
	} catch (error) {
		console.warn('Failed to get dynamic prompt, using fallback:', error);
		// 回退到硬编码提示词
		systemPrompt = "你是播客内容分析师。请识别并标注不同说话人，使用 **说话人A：**、**说话人B：** 等格式。";
	}

	const messages: ChatMessage[] = [
		{
			role: "system",
			content: systemPrompt
		},
		{
			role: "user",
			content: `请为以下内容识别并标注说话人：\n\n${text}`
		}
	];
	
	return await qwenChat(messages, { maxTokens: 2000 });
}

export type AnswerQAInput = { question: string; context: string };
export type AnswerQAOutput = { answer: string };

export async function answerQA(input: AnswerQAInput): Promise<AnswerQAOutput> {
	const messages: ChatMessage[] = [
		{
			role: "system",
			content: "你是播客内容问答助手。基于提供的上下文内容，准确回答用户问题。如果上下文中没有相关信息，请明确说明。"
		},
		{
			role: "user",
			content: `问题：${input.question}\n\n上下文：\n${input.context}`
		}
	];
	
	const answer = await qwenChat(messages, { maxTokens: 1000 });
	return { answer };
}

export type GenerateInterviewReportInput = { transcript: string; title?: string };
export type GenerateInterviewReportOutput = { summary: string };

export async function generateInterviewReport(input: GenerateInterviewReportInput): Promise<GenerateInterviewReportOutput> {
	const messages: ChatMessage[] = [
		{
			role: "system",
			content: `你是专业的访谈报告撰写专家。请基于播客访谈内容，生成一份专业的访谈报告。

**报告要求：**
1. **忽略说话人身份**：不要标注"主持人"、"嘉宾"等身份，直接呈现观点和内容
2. **保留核心内容**：必须保留至少60%以上的核心观点和论据
3. **专业格式**：采用学术报告或商业分析报告的格式
4. **结构化组织**：按主题和逻辑关系组织内容
5. **客观表达**：以第三人称客观视角呈现观点

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
- 保持内容的完整性和准确性`
		},
		{
			role: "user",
			content: `请基于以下播客访谈内容生成专业访谈报告：

**播客标题：** ${input.title || "访谈内容"}

**访谈内容：**
${input.transcript}

请生成一份专业的访谈报告，确保保留至少60%以上的核心观点和论据。`
		}
	];
	
	const report = await qwenChat(messages, { maxTokens: 3000 });
	return { summary: report };
}
