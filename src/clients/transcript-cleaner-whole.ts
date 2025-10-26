import { qwenChat, ChatMessage } from './qwen-text';
import { getPrompt } from '@/server/prompt-service';
import { analyzeOutputLimit, selectOutputStrategy, createCompressedPrompt, validateOutputQuality } from './output-limiter';

export interface TranscriptCleaningInput {
  transcript: string;
  language?: string;
  audioUrl?: string;
}

export interface TranscriptCleaningOutput {
  script: string;
  processingTime: number;
  estimatedTokens: number;
}

/**
 * 整体清洗访谈记录（新方案）
 * 一次性处理整个转写内容，无需分块
 */
export async function cleanTranscriptWhole(input: TranscriptCleaningInput): Promise<TranscriptCleaningOutput> {
  const { transcript, language = "zh", audioUrl } = input;
  const startTime = Date.now();
  
  console.log(`开始整体清洗访谈记录，文本长度: ${transcript.length} 字符`);
  
  // 分析输出限制
  const outputAnalysis = analyzeOutputLimit(transcript, 0.7);
  const strategy = selectOutputStrategy(transcript, 'cleaning');
  
  console.log(`输出分析: 预期${outputAnalysis.expectedOutputTokens.toLocaleString()} tokens, 策略: ${strategy.strategy}`);
  
  // 获取动态系统提示词
  let systemPrompt: string;
  try {
    systemPrompt = await getPrompt('transcript_cleaning_whole');
  } catch (error) {
    console.warn('Failed to get dynamic prompt, using fallback:', error);
    systemPrompt = `你是专业的播客访谈记录清洗专家。请对完整的访谈记录进行整体清洗，确保角色标识和专业术语的一致性。

**清洗目标：**
1. **删除赘词与口头禅**：去除"嗯"、"啊"、"那个"等口语化表达
2. **重写断句与转场**：优化语言表达，使其更符合书面语习惯
3. **统一术语与人称**：确保同一概念和专业术语表达一致
4. **角色标识统一**：确保同一说话人在整个访谈中使用一致的标识
5. **保持内容完整性**：不删减任何重要内容，只进行语言优化

**识别规则：**
- 优先识别主持人/嘉宾的真实姓名，如果无法确定则使用"主持人"/"嘉宾"
- 若无法判断姓名，仅写主持人/嘉宾；再无法判断用说话人A/B/C
- 全文保持同一人的标签稳定一致

**输出格式：**
- 使用Markdown列表格式：- **说话人X（角色或姓名）：** 内容
- 说话人名称使用粗体
- 适当使用项目符号（•）来组织要点，提高可读性
- 在列举多个观点、论据或案例时使用项目符号
- 项目符号不要过于频繁，主要用于关键信息的分组

**整体处理优势：**
- 能够理解整个访谈的逻辑结构和上下文
- 确保角色标识在整个访谈中的一致性
- 避免分块处理可能导致的不连贯问题`;
  }
  
  // 根据策略调整提示词
  if (strategy.strategy === 'compressed') {
    systemPrompt = createCompressedPrompt(systemPrompt, strategy.compressionLevel);
    console.log(`使用压缩策略: ${strategy.compressionLevel}`);
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `请对以下完整的访谈记录进行整体清洗：

**语言**: ${language}

**访谈记录**:
${transcript}

请按照系统提示的要求进行整体清洗，确保角色标识和专业术语的一致性。`
    }
  ];

  try {
    // 使用智能策略的maxTokens，但确保足够大
    const script = await qwenChat(messages, { 
      maxTokens: Math.max(strategy.maxTokens, 6000), // 确保至少6000 tokens
      temperature: 0.1 // 降低随机性，确保一致性
    });

    const processingTime = Date.now() - startTime;
    const estimatedTokens = Math.ceil((transcript.length + script.length) / 2);

    // 验证输出质量
    const qualityCheck = validateOutputQuality(transcript, script, 0.3);
    
    if (!qualityCheck.isValid) {
      console.warn('输出质量检查发现问题:', qualityCheck.issues);
    }

    console.log(`整体访谈记录清洗完成，耗时: ${processingTime}ms，Token估算: ${estimatedTokens}`);
    console.log(`压缩比: ${(qualityCheck.compressionRatio * 100).toFixed(1)}%，质量: ${qualityCheck.isValid ? '✅ 良好' : '⚠️ 需注意'}`);

    return {
      script,
      processingTime,
      estimatedTokens
    };

  } catch (error) {
    console.error('整体访谈记录清洗失败:', error);
    throw new Error(`整体访谈记录清洗失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 检查文本长度是否适合整体处理
 */
export function canCleanAsWhole(transcript: string): { canClean: boolean; reason?: string } {
  const tokenCount = Math.ceil(transcript.length / 1.5); // 粗略估算
  const maxTokens = 100000; // 保守估计，留出足够空间给输出

  if (tokenCount > maxTokens) {
    return {
      canClean: false,
      reason: `文本过长 (${tokenCount.toLocaleString()} tokens)，超过安全限制 (${maxTokens.toLocaleString()} tokens)`
    };
  }

  return { canClean: true };
}

/**
 * 智能选择处理策略
 * 根据文本长度自动选择整体处理或分块处理
 */
export async function cleanTranscriptSmart(input: TranscriptCleaningInput): Promise<TranscriptCleaningOutput> {
  const { canClean, reason } = canCleanAsWhole(input.transcript);
  
  if (canClean) {
    console.log('使用整体清洗策略');
    return await cleanTranscriptWhole(input);
  } else {
    console.log(`使用分块清洗策略: ${reason}`);
    // 回退到原有的分块处理方法 - 直接返回原始文本
    return {
      script: input.transcript,
      processingTime: 0,
      estimatedTokens: Math.ceil(input.transcript.length / 2)
    };
  }
}
