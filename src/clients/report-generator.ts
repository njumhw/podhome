import { qwenChat, ChatMessage } from './qwen-text';
import { getPrompt } from '@/server/prompt-service';

export interface ReportGenerationInput {
  transcript: string; // 清洗后的访谈全文（A2/A3）
  originalTranscript?: string; // ASR原文（A1）
  title?: string;
}

export interface ReportGenerationOutput {
  summary: string;
  processingTime: number;
  estimatedTokens: number;
}

/**
 * 整体生成访谈报告（新方案）
 * 一次性处理整个访谈记录，无需分块
 */
export async function generateReportWhole(input: ReportGenerationInput): Promise<ReportGenerationOutput> {
  const { transcript, originalTranscript, title } = input;
  const startTime = Date.now();
  
  console.log(`开始整体生成访谈报告，文本长度: ${transcript.length} 字符`);
  
  // 获取动态系统提示词
  let systemPrompt: string;
  try {
    systemPrompt = await getPrompt('report_generation_whole');
  } catch (error) {
    console.warn('Failed to get dynamic prompt, using fallback:', error);
    systemPrompt = `你是专业的播客访谈报告撰写专家。请基于“清洗稿+ASR原文”的全部信息，生成一份尽可能详尽、完整、连贯的播客总结/报告。

**重要限制：**
- 仅基于本次提供的播客内容撰写，禁止引入外部信息
- 冲突处理：以 ASR 原文为准，保持原意
- 信息优先：在可用token范围内尽可能详尽，覆盖所有关键观点、数据、案例与逻辑

**输出策略：**
- 不设固定字数上限；请在模型可用输出上限内尽可能详细（信息完整性优先）
- 清洗稿为主，遇到缺失或不完整时，从 ASR 原文补齐原意

**报告要求：**
1. **忽略说话人身份**：不要标注"主持人"、"嘉宾"等身份，直接呈现观点和内容
2. **保留核心内容**：尽可能覆盖所有核心观点和论据
3. **专业格式**：采用学术报告或商业分析报告的格式
4. **结构化组织**：按主题和逻辑关系组织内容
5. **客观表达**：以第三人称客观视角呈现观点
6. **整体连贯**：确保报告各部分之间的逻辑连贯性

**格式要求：**
- 适当使用项目符号（•）来组织要点，提高可读性
- 在列举多个观点、论据或案例时使用项目符号
- 项目符号不要过于频繁，主要用于关键信息的分组
- 保持内容的层次感和结构清晰
- 使用Markdown格式

**报告结构（建议）：**
- **引言**：概述播客主题、背景与主要议题
- **核心观点**：按主题组织主要观点和论据，这是最重要的部分
- **总结与启示**：提炼核心洞见和讨论价值

**输出要求：**
- 删除口头语、冗余句、重复信息
- 使用正式、清晰、逻辑性强的书面语
- 保持逻辑清晰，突出核心观点
- 避免口语化表达
- **最大化信息价值**：优先保留最重要的观点和案例
- **绝对禁止添加内容**：不得添加任何播客中未提及的信息、观点或解释
- **忠实原文原则**：所有内容必须严格基于本次提供的内容，不得有任何新增`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `请基于以下两份材料生成最详尽的播客总结/报告（以清洗稿为主，缺失时从ASR补齐；不得引入外部信息）：

**播客标题**: ${title || '未提供'}

**清洗稿（主）**:
${transcript}

**ASR原文（辅）**:
${originalTranscript || '(未提供)'}

请生成一份完整、连贯、专业且尽可能详尽的报告。`
    }
  ];

  try {
    // 质量优先：使用通义千问的最大输出限制
    const maxOutputTokens = 32000; // 充分利用模型输出上限
    
    console.log(`质量优先设置maxTokens: ${maxOutputTokens} (通义千问最大输出限制)`);
    console.log(`输入文本长度: ${transcript.length} 字符`);
    
    // 使用最大输出限制，确保总结完整性
    const summary = await qwenChat(messages, { 
      maxTokens: maxOutputTokens, // 使用最大输出限制，质量优先
      temperature: 0.1 // 降低随机性，确保一致性
    });

    const processingTime = Date.now() - startTime;
    const estimatedTokens = Math.ceil((transcript.length + summary.length) / 2);

    console.log(`整体报告生成完成，耗时: ${processingTime}ms，Token估算: ${estimatedTokens}`);

    return {
      summary,
      processingTime,
      estimatedTokens
    };

  } catch (error) {
    console.error('整体报告生成失败:', error);
    throw new Error(`整体报告生成失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 检查文本长度是否适合整体处理
 */
export function canProcessAsWhole(transcript: string): { canProcess: boolean; reason?: string } {
  const tokenCount = Math.ceil(transcript.length / 1.5); // 粗略估算
  const maxTokens = 200000; // 提高限制，支持更长的播客

  if (tokenCount > maxTokens) {
    return {
      canProcess: false,
      reason: `文本过长 (${tokenCount.toLocaleString()} tokens)，超过安全限制 (${maxTokens.toLocaleString()} tokens)`
    };
  }

  return { canProcess: true };
}

/**
 * 智能选择处理策略
 * 根据文本长度自动选择整体处理或分块处理
 */
export async function generateReportSmart(input: ReportGenerationInput): Promise<ReportGenerationOutput> {
  const { canProcess, reason } = canProcessAsWhole(input.transcript);
  
  if (canProcess) {
    console.log('使用整体处理策略');
    return await generateReportWhole(input);
  } else {
    console.log(`使用分块处理策略: ${reason}`);
    // 回退到原有的分块处理方法
    const { generateInterviewReport } = await import('@/clients/qwen-text');
    const result = await generateInterviewReport({ transcript: input.transcript, title: input.title });
    return {
      summary: result.summary,
      processingTime: 0, // 分块处理时间计算复杂，这里简化
      estimatedTokens: Math.ceil((input.transcript.length + result.summary.length) / 2)
    };
  }
}
