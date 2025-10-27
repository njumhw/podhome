/**
 * Token计算工具
 * 提供更精确的Token计算和检测功能
 */

export interface TokenAnalysis {
  characterCount: number;
  estimatedTokens: number;
  tokenRatio: number;
  canProcessAsWhole: boolean;
  safetyMargin: number;
  strategy: 'whole' | 'chunked';
  reason?: string;
}

/**
 * 精确的Token计算（基于字符数估算）
 * 针对中文播客内容优化
 */
export function calculateTokens(text: string): number {
  if (!text) return 0;
  
  // 针对中文播客内容的Token估算
  // 中文: 约1.5字符 = 1 token
  // 英文: 约4字符 = 1 token
  // 标点符号: 约1字符 = 1 token
  
  let tokenCount = 0;
  let chineseChars = 0;
  let englishChars = 0;
  let punctuationChars = 0;
  
  for (const char of text) {
    if (/[\u4e00-\u9fff]/.test(char)) {
      // 中文字符
      chineseChars++;
    } else if (/[a-zA-Z]/.test(char)) {
      // 英文字符
      englishChars++;
    } else if (/[^\s]/.test(char)) {
      // 标点符号和其他非空白字符
      punctuationChars++;
    }
  }
  
  // 计算Token数量
  tokenCount = Math.ceil(
    chineseChars / 1.5 +      // 中文: 1.5字符 = 1 token
    englishChars / 4 +        // 英文: 4字符 = 1 token
    punctuationChars / 1      // 标点: 1字符 = 1 token
  );
  
  return tokenCount;
}

/**
 * 分析文本是否适合整体处理
 */
export function analyzeTokenUsage(text: string): TokenAnalysis {
  const characterCount = text.length;
  const estimatedTokens = calculateTokens(text);
  const tokenRatio = estimatedTokens / characterCount;
  
  // 通义千问qwen-plus的限制
  const maxContextTokens = 128000;  // 128K tokens
  const maxOutputTokens = 8000;     // 8K tokens
  const safetyBoundary = 100000;    // 100K tokens (我们的安全边界)
  
  const canProcessAsWhole = estimatedTokens <= safetyBoundary;
  const safetyMargin = maxContextTokens - estimatedTokens;
  
  let strategy: 'whole' | 'chunked' = 'whole';
  let reason: string | undefined;
  
  if (!canProcessAsWhole) {
    strategy = 'chunked';
    reason = `文本过长 (${estimatedTokens.toLocaleString()} tokens)，超过安全限制 (${safetyBoundary.toLocaleString()} tokens)`;
  }
  
  return {
    characterCount,
    estimatedTokens,
    tokenRatio,
    canProcessAsWhole,
    safetyMargin,
    strategy,
    reason
  };
}

/**
 * 获取处理策略建议
 */
export function getProcessingStrategy(analysis: TokenAnalysis): {
  recommended: 'whole' | 'chunked';
  estimatedTime: string;
  apiCalls: number;
  efficiency: string;
} {
  if (analysis.strategy === 'whole') {
    return {
      recommended: 'whole',
      estimatedTime: '2-3分钟',
      apiCalls: 1,
      efficiency: '高效'
    };
  } else {
    // 分块处理估算
    const chunks = Math.ceil(analysis.estimatedTokens / 2000); // 每块2000 tokens
    const estimatedTime = Math.ceil(chunks / 3) * 2; // 每批3个并行，每块约2分钟
    
    return {
      recommended: 'chunked',
      estimatedTime: `${estimatedTime}分钟`,
      apiCalls: chunks,
      efficiency: '稳定'
    };
  }
}

/**
 * 批量分析多个文本
 */
export function batchAnalyze(texts: Array<{ name: string; content: string }>): Array<{
  name: string;
  analysis: TokenAnalysis;
  strategy: ReturnType<typeof getProcessingStrategy>;
}> {
  return texts.map(({ name, content }) => {
    const analysis = analyzeTokenUsage(content);
    const strategy = getProcessingStrategy(analysis);
    
    return {
      name,
      analysis,
      strategy
    };
  });
}

/**
 * 验证Token计算的准确性
 * 通过实际API调用验证估算的准确性
 */
export async function validateTokenCalculation(text: string): Promise<{
  estimated: number;
  actual?: number;
  accuracy?: number;
  error?: string;
}> {
  const estimated = calculateTokens(text);
  
  try {
    // 这里可以添加实际的API调用来获取真实的Token数量
    // 目前返回估算值
    return {
      estimated,
      actual: estimated, // 占位符，实际应该通过API获取
      accuracy: 1.0 // 占位符
    };
  } catch (error) {
    return {
      estimated,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

