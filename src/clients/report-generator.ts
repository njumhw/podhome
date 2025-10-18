import { qwenChat, ChatMessage } from './qwen-text';
import { getPrompt } from '@/server/prompt-service';

export interface ReportGenerationInput {
  transcript: string;
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
  const { transcript, title } = input;
  const startTime = Date.now();
  
  console.log(`开始整体生成访谈报告，文本长度: ${transcript.length} 字符`);
  
  // 获取动态系统提示词
  let systemPrompt: string;
  try {
    systemPrompt = await getPrompt('report_generation_whole');
  } catch (error) {
    console.warn('Failed to get dynamic prompt, using fallback:', error);
    systemPrompt = `你是专业的播客访谈报告撰写专家。请基于完整的播客访谈内容，生成一份专业、完整、连贯的访谈报告。

**重要限制：**
- **仅参考播客内容**：严格限制只使用提供的播客访谈内容，不得引用、参考或提及任何外部信息、资料、书籍、论文、网站或其他来源
- **禁止外部引用**：不得添加任何"参考资料来源"、"参考文献"或类似的外部信息引用
- **内容来源唯一**：所有观点、论据、案例都必须来自播客内容本身
- **禁止新增信息**：不得添加任何播客中未提及的信息、观点、解释或补充说明
- **禁止个人解读**：不得添加任何个人理解、推测、分析或延伸思考
- **严格忠实原文**：只能整理、组织和重新表述播客中已有的内容

**字数限制：**
- **最大字数：10000-12000字**：这是你的输出字数上限，请在这个限制内完成整个播客总结
- **智能分配**：根据播客内容的重要性和深度，智能分配各部分字数
- **完整优先**：确保在字数限制内提供最完整、最有价值的信息

**报告要求：**
1. **忽略说话人身份**：不要标注"主持人"、"嘉宾"等身份，直接呈现观点和内容
2. **保留核心内容**：必须保留至少60%以上的核心观点和论据
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

**报告结构（在10000-12000字限制内）：**
- **引言**（约1000-1500字）：概述播客主题、背景与主要议题
- **核心观点**（约7000-9000字）：按主题组织主要观点和论据，这是最重要的部分
- **总结与启示**（约1000-1500字）：提炼核心洞见和讨论价值

**输出要求：**
- **严格控制在10000-12000字以内**：这是硬性限制，请确保不超出
- 删除口头语、冗余句、重复信息
- 使用正式、清晰、逻辑性强的书面语
- 保持逻辑清晰，突出核心观点
- 避免口语化表达
- **在字数限制内最大化信息价值**：优先保留最重要的观点和案例
- **绝对禁止添加内容**：不得添加任何播客中未提及的信息、观点或解释
- **忠实原文原则**：所有内容必须严格基于播客访谈原文，不得有任何新增`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `请基于以下完整的播客访谈内容生成专业报告：

**播客标题**: ${title || '未提供'}

**访谈记录**:
${transcript}

请生成一份完整、连贯、专业的访谈报告。`
    }
  ];

  try {
    // 质量优先：使用通义千问的最大输出限制
    const maxOutputTokens = 8000; // 通义千问qwen-plus的最大输出限制
    
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
  const maxTokens = 100000; // 保守估计，留出足够空间给输出

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
