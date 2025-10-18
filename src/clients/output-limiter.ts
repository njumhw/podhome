/**
 * 输出限制处理工具
 * 解决通义千问8K tokens输出限制问题
 */

export interface OutputLimitAnalysis {
  inputTokens: number;
  expectedOutputTokens: number;
  maxOutputTokens: number;
  canOutputComplete: boolean;
  outputRatio: number;
  strategy: 'complete' | 'chunked' | 'compressed';
  reason?: string;
}

export interface ChunkedOutputResult {
  chunks: string[];
  totalLength: number;
  processingTime: number;
  estimatedTokens: number;
}

/**
 * 分析输出限制影响
 */
export function analyzeOutputLimit(
  inputText: string, 
  expectedOutputRatio: number = 0.7
): OutputLimitAnalysis {
  const inputTokens = Math.ceil(inputText.length / 1.5);
  const expectedOutputTokens = Math.ceil(inputTokens * expectedOutputRatio);
  const maxOutputTokens = 8000; // 通义千问单次输出限制
  
  const canOutputComplete = expectedOutputTokens <= maxOutputTokens;
  const outputRatio = expectedOutputTokens / maxOutputTokens;
  
  let strategy: 'complete' | 'chunked' | 'compressed' = 'complete';
  let reason: string | undefined;
  
  if (!canOutputComplete) {
    if (outputRatio <= 2) {
      strategy = 'chunked';
      reason = `输出过长 (${expectedOutputTokens.toLocaleString()} tokens)，需要分块输出`;
    } else {
      strategy = 'compressed';
      reason = `输出过长 (${expectedOutputTokens.toLocaleString()} tokens)，需要压缩处理`;
    }
  }
  
  return {
    inputTokens,
    expectedOutputTokens,
    maxOutputTokens,
    canOutputComplete,
    outputRatio,
    strategy,
    reason
  };
}

/**
 * 智能分块输出
 * 将长内容分成多个8K tokens的块
 */
export async function chunkedOutput<T>(
  inputText: string,
  processor: (chunk: string, index: number) => Promise<T>,
  chunkSize: number = 12000, // 12K字符，约8K tokens
  overlap: number = 1000     // 1K字符重叠
): Promise<ChunkedOutputResult> {
  const startTime = Date.now();
  
  // 分块
  const chunks: string[] = [];
  let i = 0;
  
  while (i < inputText.length) {
    const end = Math.min(inputText.length, i + chunkSize);
    const chunk = inputText.slice(i, end);
    chunks.push(chunk);
    
    if (end >= inputText.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  
  console.log(`分块完成，共 ${chunks.length} 个块`);
  
  // 处理每个块
  const results: T[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`处理块 ${i + 1}/${chunks.length}`);
    const result = await processor(chunks[i], i);
    results.push(result);
  }
  
  // 合并结果
  const combinedResult = results.join('\n\n');
  
  return {
    chunks: results.map(r => String(r)),
    totalLength: combinedResult.length,
    processingTime: Date.now() - startTime,
    estimatedTokens: Math.ceil(combinedResult.length / 1.5)
  };
}

/**
 * 压缩输出策略
 * 通过更激进的压缩来减少输出长度
 */
export function createCompressedPrompt(basePrompt: string, compressionLevel: 'high' | 'extreme' = 'high'): string {
  const compressionInstructions = {
    high: `
**压缩要求（高级）：**
- 删除所有冗余信息和重复内容
- 合并相似观点，避免重复表达
- 使用简洁的语言，避免冗长描述
- 保留核心观点，删除次要细节
- 压缩比目标：40-50%`,
    
    extreme: `
**压缩要求（极端）：**
- 极度精简，只保留最核心的观点
- 删除所有修饰词和冗余表达
- 使用最简洁的语言结构
- 合并所有相似内容
- 压缩比目标：20-30%`
  };
  
  return basePrompt + '\n\n' + compressionInstructions[compressionLevel];
}

/**
 * 输出质量检查
 * 验证输出是否完整
 */
export function validateOutputQuality(
  inputText: string,
  outputText: string,
  minCompressionRatio: number = 0.3 // 提高到30%，确保内容完整性
): {
  isValid: boolean;
  compressionRatio: number;
  issues: string[];
} {
  const inputLength = inputText.length;
  const outputLength = outputText.length;
  const compressionRatio = outputLength / inputLength;
  
  const issues: string[] = [];
  
  // 严格检查压缩比，确保内容完整性
  if (compressionRatio < minCompressionRatio) {
    issues.push(`压缩比过低 (${(compressionRatio * 100).toFixed(1)}%)，内容可能严重丢失`);
  }
  
  // 检查最小长度
  if (outputLength < 1000) {
    issues.push('输出过短，可能内容不完整');
  }
  
  // 检查是否包含关键信息
  const keyWords = ['主持人', '嘉宾', '讨论', '观点', '问题'];
  const hasKeyWords = keyWords.some(word => outputText.includes(word));
  
  if (!hasKeyWords) {
    issues.push('输出缺少关键信息标识');
  }
  
  // 检查内容密度
  const inputSentences = inputText.split(/[。！？]/).length;
  const outputSentences = outputText.split(/[。！？]/).length;
  const sentenceRatio = outputSentences / inputSentences;
  
  if (sentenceRatio < 0.2) {
    issues.push(`句子数量过少 (${(sentenceRatio * 100).toFixed(1)}%)，可能内容丢失严重`);
  }
  
  return {
    isValid: issues.length === 0,
    compressionRatio,
    issues
  };
}

/**
 * 智能输出策略选择
 */
export function selectOutputStrategy(
  inputText: string,
  taskType: 'cleaning' | 'optimization' | 'summarization'
): {
  strategy: 'complete' | 'chunked' | 'compressed';
  maxTokens: number;
  compressionLevel?: 'high' | 'extreme';
  reason: string;
} {
  const analysis = analyzeOutputLimit(inputText, getExpectedRatio(taskType));
  
  // 对于访谈记录清洗，优先使用分块处理而不是压缩处理
  if (taskType === 'cleaning') {
    if (analysis.expectedOutputTokens <= 8000) {
      return {
        strategy: 'complete',
        maxTokens: 8000,
        reason: '输出长度在限制范围内'
      };
    } else {
      // 即使超出限制，也使用分块处理而不是压缩处理
      return {
        strategy: 'chunked',
        maxTokens: 8000,
        reason: '使用分块处理确保内容完整性'
      };
    }
  }
  
  // 其他任务类型保持原有逻辑
  if (analysis.strategy === 'complete') {
    return {
      strategy: 'complete',
      maxTokens: 8000,
      reason: '输出长度在限制范围内'
    };
  } else if (analysis.strategy === 'chunked') {
    return {
      strategy: 'chunked',
      maxTokens: 8000,
      reason: analysis.reason || '需要分块处理'
    };
  } else {
    return {
      strategy: 'compressed',
      maxTokens: 8000,
      compressionLevel: analysis.outputRatio > 3 ? 'extreme' : 'high',
      reason: analysis.reason || '需要压缩处理'
    };
  }
}

/**
 * 获取不同任务的预期输出比例
 */
function getExpectedRatio(taskType: 'cleaning' | 'optimization' | 'summarization'): number {
  switch (taskType) {
    case 'cleaning': return 0.7;      // 清洗后通常70%
    case 'optimization': return 0.8;  // 优化后通常80%
    case 'summarization': return 0.15; // 总结通常15%
    default: return 0.7;
  }
}
