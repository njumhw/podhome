/**
 * 内容完整性管理器
 * 基于用户设定的原则，确保内容完整性
 */

export interface ContentIntegrityConfig {
  // 访谈全文处理原则
  transcriptToScript: {
    minRatio: 0.95;  // 至少95%的内容保留
    maxRatio: 1.0;   // 最多100%（只删除语气词）
    description: "只删除语气词，保留所有有价值内容";
  };
  
  // 访谈总结处理原则
  transcriptToSummary: {
    minRatio: 0.6;   // 至少60%的内容保留
    maxRatio: 0.8;   // 最多80%（以总结报告形式呈现）
    description: "去除访谈形式，以总结报告形式呈现";
  };
}

export interface ProcessingStrategy {
  method: 'whole' | 'chunked' | 'hybrid';
  maxInputTokens: number;
  maxOutputTokens: number;
  chunkSize?: number;
  overlap?: number;
  reason: string;
}

export interface ContentAnalysis {
  inputLength: number;
  inputTokens: number;
  expectedOutputLength: number;
  expectedOutputTokens: number;
  canProcessAsWhole: boolean;
  strategy: ProcessingStrategy;
  integrityCheck: {
    meetsTranscriptToScript: boolean;
    meetsTranscriptToSummary: boolean;
    issues: string[];
  };
}

/**
 * 内容完整性配置
 */
export const CONTENT_INTEGRITY_CONFIG: ContentIntegrityConfig = {
  transcriptToScript: {
    minRatio: 0.95,
    maxRatio: 1.0,
    description: "只删除语气词，保留所有有价值内容"
  },
  transcriptToSummary: {
    minRatio: 0.6,
    maxRatio: 0.8,
    description: "去除访谈形式，以总结报告形式呈现"
  }
};

/**
 * 分析内容并确定处理策略
 */
export function analyzeContentForIntegrity(
  inputText: string,
  taskType: 'transcript-to-script' | 'transcript-to-summary'
): ContentAnalysis {
  const inputLength = inputText.length;
  const inputTokens = Math.ceil(inputLength / 1.5);
  
  // 根据任务类型确定预期输出比例
  const config = taskType === 'transcript-to-script' 
    ? CONTENT_INTEGRITY_CONFIG.transcriptToScript
    : CONTENT_INTEGRITY_CONFIG.transcriptToSummary;
  
  const expectedOutputLength = Math.ceil(inputLength * config.minRatio);
  const expectedOutputTokens = Math.ceil(expectedOutputLength / 1.5);
  
  // 确定处理策略
  const strategy = determineProcessingStrategy(inputTokens, expectedOutputTokens);
  
  // 完整性检查
  const integrityCheck = {
    meetsTranscriptToScript: taskType === 'transcript-to-script' 
      ? expectedOutputTokens <= 8000 
      : true,
    meetsTranscriptToSummary: taskType === 'transcript-to-summary'
      ? expectedOutputTokens <= 8000
      : true,
    issues: [] as string[]
  };
  
  if (!integrityCheck.meetsTranscriptToScript && taskType === 'transcript-to-script') {
    integrityCheck.issues.push(`访谈全文输出过长 (${expectedOutputTokens.toLocaleString()} tokens)，需要分块处理`);
  }
  
  if (!integrityCheck.meetsTranscriptToSummary && taskType === 'transcript-to-summary') {
    integrityCheck.issues.push(`访谈总结输出过长 (${expectedOutputTokens.toLocaleString()} tokens)，需要分块处理`);
  }
  
  return {
    inputLength,
    inputTokens,
    expectedOutputLength,
    expectedOutputTokens,
    canProcessAsWhole: strategy.method === 'whole',
    strategy,
    integrityCheck
  };
}

/**
 * 确定处理策略
 */
function determineProcessingStrategy(
  inputTokens: number,
  expectedOutputTokens: number
): ProcessingStrategy {
  const maxInputTokens = 100000;  // 100K tokens安全边界
  const maxOutputTokens = 8000;   // 8K tokens输出限制
  
  // 如果输入和输出都在限制内，使用整体处理
  if (inputTokens <= maxInputTokens && expectedOutputTokens <= maxOutputTokens) {
    return {
      method: 'whole',
      maxInputTokens,
      maxOutputTokens,
      reason: '输入和输出都在限制范围内，可以使用整体处理'
    };
  }
  
  // 如果输入超出限制，使用分块处理
  if (inputTokens > maxInputTokens) {
    const chunkSize = Math.floor(maxInputTokens * 1.5 * 0.8); // 80%安全边界
    const overlap = Math.floor(chunkSize * 0.1); // 10%重叠
    
    return {
      method: 'chunked',
      maxInputTokens,
      maxOutputTokens,
      chunkSize,
      overlap,
      reason: `输入过长 (${inputTokens.toLocaleString()} tokens)，使用分块处理`
    };
  }
  
  // 如果输出超出限制，使用混合策略
  if (expectedOutputTokens > maxOutputTokens) {
    return {
      method: 'hybrid',
      maxInputTokens,
      maxOutputTokens,
      reason: `输出过长 (${expectedOutputTokens.toLocaleString()} tokens)，使用混合策略`
    };
  }
  
  // 默认使用整体处理
  return {
    method: 'whole',
    maxInputTokens,
    maxOutputTokens,
    reason: '使用整体处理'
  };
}

/**
 * 验证输出完整性
 */
export function validateContentIntegrity(
  inputText: string,
  outputText: string,
  taskType: 'transcript-to-script' | 'transcript-to-summary'
): {
  isValid: boolean;
  actualRatio: number;
  expectedRatio: number;
  issues: string[];
  score: number; // 0-100分
} {
  const inputLength = inputText.length;
  const outputLength = outputText.length;
  const actualRatio = outputLength / inputLength;
  
  const config = taskType === 'transcript-to-script' 
    ? CONTENT_INTEGRITY_CONFIG.transcriptToScript
    : CONTENT_INTEGRITY_CONFIG.transcriptToSummary;
  
  const expectedRatio = config.minRatio;
  const issues: string[] = [];
  let score = 100;
  
  // 检查压缩比
  if (actualRatio < expectedRatio) {
    const deficit = (expectedRatio - actualRatio) * 100;
    issues.push(`压缩比过低 (${(actualRatio * 100).toFixed(1)}%)，低于要求 (${(expectedRatio * 100).toFixed(1)}%)，缺失 ${deficit.toFixed(1)}% 内容`);
    score -= deficit * 2; // 每缺失1%扣2分
  }
  
  // 检查是否过度压缩
  if (actualRatio > config.maxRatio) {
    const excess = (actualRatio - config.maxRatio) * 100;
    issues.push(`压缩比过高 (${(actualRatio * 100).toFixed(1)}%)，超过上限 (${(config.maxRatio * 100).toFixed(1)}%)，可能包含冗余内容`);
    score -= excess; // 每超出1%扣1分
  }
  
  // 检查最小长度
  const minLength = Math.ceil(inputLength * expectedRatio);
  if (outputLength < minLength) {
    issues.push(`输出长度过短 (${outputLength.toLocaleString()} 字符)，低于最小要求 (${minLength.toLocaleString()} 字符)`);
    score -= 20;
  }
  
  // 检查内容质量
  const keyWords = ['主持人', '嘉宾', '讨论', '观点', '问题'];
  const hasKeyWords = keyWords.some(word => outputText.includes(word));
  
  if (!hasKeyWords) {
    issues.push('输出缺少关键信息标识');
    score -= 15;
  }
  
  return {
    isValid: issues.length === 0,
    actualRatio,
    expectedRatio,
    issues,
    score: Math.max(0, score)
  };
}

/**
 * 生成内容完整性报告
 */
export function generateIntegrityReport(
  inputText: string,
  outputText: string,
  taskType: 'transcript-to-script' | 'transcript-to-summary',
  processingTime: number
): {
  summary: string;
  details: {
    inputLength: number;
    outputLength: number;
    actualRatio: number;
    expectedRatio: number;
    score: number;
    processingTime: number;
    issues: string[];
  };
} {
  const validation = validateContentIntegrity(inputText, outputText, taskType);
  const config = taskType === 'transcript-to-script' 
    ? CONTENT_INTEGRITY_CONFIG.transcriptToScript
    : CONTENT_INTEGRITY_CONFIG.transcriptToSummary;
  
  let summary = '';
  if (validation.isValid) {
    summary = `✅ 内容完整性检查通过 (${validation.score}分)`;
  } else {
    summary = `⚠️ 内容完整性检查发现问题 (${validation.score}分)`;
  }
  
  return {
    summary,
    details: {
      inputLength: inputText.length,
      outputLength: outputText.length,
      actualRatio: validation.actualRatio,
      expectedRatio: validation.expectedRatio,
      score: validation.score,
      processingTime,
      issues: validation.issues
    }
  };
}
