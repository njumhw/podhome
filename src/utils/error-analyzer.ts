/**
 * 错误分析和诊断工具
 * 用于在整个处理流程的每个关键节点记录和分析错误
 */

export interface ErrorContext {
  step: string;
  stepNumber: number;
  timestamp: number;
  duration?: number;
  inputSize?: number;
  outputSize?: number;
  metadata?: Record<string, any>;
  previousSteps?: string[];
}

export interface ErrorAnalysis {
  errorType: 'network' | 'api' | 'data' | 'timeout' | 'validation' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  context: ErrorContext;
  possibleCauses: string[];
  suggestedActions: string[];
  relatedMetrics?: Record<string, any>;
}

/**
 * 分析错误并生成诊断信息
 */
export function analyzeError(error: unknown, context: ErrorContext): ErrorAnalysis {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // 错误类型判断
  let errorType: ErrorAnalysis['errorType'] = 'unknown';
  let severity: ErrorAnalysis['severity'] = 'medium';
  const possibleCauses: string[] = [];
  const suggestedActions: string[] = [];
  
  // 网络错误
  if (/fetch|network|timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(errorMessage)) {
    errorType = 'network';
    severity = 'high';
    possibleCauses.push('网络连接不稳定');
    possibleCauses.push('目标服务器不可达');
    possibleCauses.push('DNS解析失败');
    suggestedActions.push('检查网络连接');
    suggestedActions.push('重试请求');
    suggestedActions.push('检查代理设置');
  }
  
  // API错误
  else if (/api|http|status|400|401|403|404|500|502|503/i.test(errorMessage)) {
    errorType = 'api';
    severity = 'high';
    possibleCauses.push('API服务异常');
    possibleCauses.push('请求参数错误');
    possibleCauses.push('API限流或配额超限');
    suggestedActions.push('检查API配置');
    suggestedActions.push('查看API响应详情');
    suggestedActions.push('检查API配额');
  }
  
  // 内容审核/输入限制错误
  else if (/inappropriate|内容审核|内容安全|input|limit|限制/i.test(errorMessage)) {
    errorType = 'api';
    severity = 'medium';
    possibleCauses.push('输入内容触发API审核机制');
    possibleCauses.push('输入长度超过API限制');
    possibleCauses.push('请求体格式问题');
    suggestedActions.push('尝试分块处理');
    suggestedActions.push('检查输入内容');
    suggestedActions.push('查看完整错误响应');
  }
  
  // 超时错误
  else if (/timeout|超时|timed out/i.test(errorMessage)) {
    errorType = 'timeout';
    severity = context.stepNumber <= 2 ? 'high' : 'medium';
    possibleCauses.push('处理时间过长');
    possibleCauses.push('网络延迟过高');
    possibleCauses.push('服务器负载过高');
    suggestedActions.push('增加超时时间');
    suggestedActions.push('检查服务器性能');
    suggestedActions.push('考虑分块处理');
  }
  
  // 数据验证错误
  else if (/validation|invalid|missing|required|格式错误/i.test(errorMessage)) {
    errorType = 'validation';
    severity = 'medium';
    possibleCauses.push('数据格式不正确');
    possibleCauses.push('必填字段缺失');
    possibleCauses.push('数据类型不匹配');
    suggestedActions.push('检查输入数据格式');
    suggestedActions.push('验证必填字段');
    suggestedActions.push('查看数据验证规则');
  }
  
  // 数据错误
  else if (/data|database|prisma|sql|constraint/i.test(errorMessage)) {
    errorType = 'data';
    severity = 'high';
    possibleCauses.push('数据库连接问题');
    possibleCauses.push('数据约束冲突');
    possibleCauses.push('数据格式问题');
    suggestedActions.push('检查数据库连接');
    suggestedActions.push('查看数据库日志');
    suggestedActions.push('验证数据完整性');
  }
  
  // 根据上下文调整严重程度
  if (context.stepNumber === 1) {
    severity = 'critical'; // 第一步失败，整个流程无法继续
  } else if (context.stepNumber === 2) {
    severity = 'critical'; // ASR失败，无法生成报告
  }
  
  return {
    errorType,
    severity,
    message: errorMessage,
    context,
    possibleCauses,
    suggestedActions,
    relatedMetrics: {
      duration: context.duration,
      inputSize: context.inputSize,
      outputSize: context.outputSize,
      stack: errorStack?.substring(0, 500) // 只保留前500字符
    }
  };
}

/**
 * 记录错误分析结果
 */
export function logErrorAnalysis(analysis: ErrorAnalysis) {
  const emoji = {
    low: '⚠️',
    medium: '🔶',
    high: '🔴',
    critical: '💥'
  }[analysis.severity];
  
  console.error(`\n${emoji} [错误分析] ${analysis.context.step}`);
  console.error(`   步骤: ${analysis.context.stepNumber}/5`);
  console.error(`   类型: ${analysis.errorType}`);
  console.error(`   严重程度: ${analysis.severity}`);
  console.error(`   错误信息: ${analysis.message}`);
  console.error(`   耗时: ${analysis.context.duration ? `${(analysis.context.duration / 1000).toFixed(1)}秒` : '未知'}`);
  
  if (analysis.context.inputSize) {
    console.error(`   输入大小: ${analysis.context.inputSize.toLocaleString()} 字符`);
  }
  
  console.error(`\n   可能原因:`);
  analysis.possibleCauses.forEach((cause, i) => {
    console.error(`     ${i + 1}. ${cause}`);
  });
  
  console.error(`\n   建议操作:`);
  analysis.suggestedActions.forEach((action, i) => {
    console.error(`     ${i + 1}. ${action}`);
  });
  
  if (analysis.relatedMetrics?.stack) {
    console.error(`\n   错误堆栈（前500字符）:`);
    console.error(`   ${analysis.relatedMetrics.stack}`);
  }
  
  console.error('');
}

/**
 * 创建错误上下文
 */
export function createErrorContext(
  step: string,
  stepNumber: number,
  startTime: number,
  metadata?: Record<string, any>
): ErrorContext {
  return {
    step,
    stepNumber,
    timestamp: Date.now(),
    duration: Date.now() - startTime,
    metadata,
    previousSteps: []
  };
}




