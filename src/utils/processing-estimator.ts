// 播客处理进度估算工具

export interface ProcessingStep {
  id: string;
  name: string;
  description: string;
  estimatedTime: number; // 预计时间（秒）
  weight: number; // 在总进度中的权重
}

export interface ProcessingEstimate {
  steps: ProcessingStep[];
  totalEstimatedTime: number;
  currentStep: string;
  overallProgress: number;
  estimatedRemainingTime: number;
}

// 预定义的处理步骤
const PROCESSING_STEPS: ProcessingStep[] = [
  {
    id: 'parse',
    name: '解析播客信息',
    description: '正在获取播客标题、作者、发布时间等信息',
    estimatedTime: 30,
    weight: 0.1
  },
  {
    id: 'download',
    name: '下载音频文件',
    description: '正在下载播客音频文件到服务器',
    estimatedTime: 90,
    weight: 0.15
  },
  {
    id: 'asr',
    name: '语音转文字',
    description: '正在将音频转换为文字稿',
    estimatedTime: 360, // 6分钟
    weight: 0.5
  },
  {
    id: 'clean',
    name: '清理文字稿',
    description: '正在优化文字稿格式和内容',
    estimatedTime: 60,
    weight: 0.15
  },
  {
    id: 'summarize',
    name: '生成播客总结',
    description: '正在分析内容并生成播客总结',
    estimatedTime: 180, // 3分钟
    weight: 0.1
  }
];

// 根据音频时长调整ASR时间
export function adjustASRTimeForDuration(durationSeconds: number): number {
  // 基于实际观察：1小时音频15-20分钟处理完成
  // 使用更保守的估算，确保不会过早显示100%
  const totalProcessingTime = durationSeconds / 3.0; // 3倍速处理（保守估算）
  const asrTime = totalProcessingTime * 0.6; // ASR占60%
  return Math.max(60, asrTime); // 最少1分钟
}

// 根据文本长度调整总结时间
export function adjustSummaryTimeForText(textLength: number): number {
  // 基于实际观察：使用保守估算确保不会过早显示100%
  // 假设每分钟音频产生800字符
  const estimatedAudioDuration = textLength / 800; // 估算音频时长
  const totalProcessingTime = estimatedAudioDuration * 60 / 3.0; // 3倍速处理（保守估算）
  const summaryTime = totalProcessingTime * 0.15; // 总结占15%
  return Math.max(30, summaryTime); // 最少30秒
}

// 获取处理进度估算
export function getProcessingEstimate(
  elapsedTime: number,
  audioDuration?: number,
  textLength?: number
): ProcessingEstimate {
  const steps = [...PROCESSING_STEPS];
  
  // 根据音频时长调整ASR时间
  if (audioDuration) {
    const asrStep = steps.find(step => step.id === 'asr');
    if (asrStep) {
      asrStep.estimatedTime = adjustASRTimeForDuration(audioDuration);
    }
  }
  
  // 根据文本长度调整总结时间
  if (textLength) {
    const summaryStep = steps.find(step => step.id === 'summarize');
    if (summaryStep) {
      summaryStep.estimatedTime = adjustSummaryTimeForText(textLength);
    }
  }
  
  const totalEstimatedTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);
  
  // 计算当前步骤和进度
  let currentStep = 'parse';
  let overallProgress = 0;
  let estimatedRemainingTime = totalEstimatedTime;
  
  let accumulatedTime = 0;
  for (const step of steps) {
    if (elapsedTime <= accumulatedTime + step.estimatedTime) {
      currentStep = step.id;
      const stepProgress = Math.min(1, (elapsedTime - accumulatedTime) / step.estimatedTime);
      overallProgress = accumulatedTime / totalEstimatedTime + (stepProgress * step.weight);
      estimatedRemainingTime = totalEstimatedTime - elapsedTime;
      break;
    }
    accumulatedTime += step.estimatedTime;
    overallProgress += step.weight;
  }
  
  // 如果超过总预计时间，标记为完成
  if (elapsedTime >= totalEstimatedTime) {
    currentStep = 'completed';
    overallProgress = 1;
    estimatedRemainingTime = 0;
  }
  
  // 如果所有步骤都已完成，也标记为完成
  const allStepsCompleted = steps.every((step, index) => {
    let accumulatedTime = 0;
    for (let i = 0; i < index; i++) {
      accumulatedTime += steps[i].estimatedTime;
    }
    return elapsedTime >= accumulatedTime + step.estimatedTime;
  });
  
  if (allStepsCompleted) {
    currentStep = 'completed';
    overallProgress = 1;
    estimatedRemainingTime = 0;
  }
  
  return {
    steps,
    totalEstimatedTime,
    currentStep,
    overallProgress: Math.min(1, overallProgress),
    estimatedRemainingTime: Math.max(0, estimatedRemainingTime)
  };
}

// 格式化时间显示
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `约${Math.ceil(seconds)}秒`;
  } else if (seconds < 3600) {
    return `约${Math.ceil(seconds / 60)}分钟`;
  } else {
    return `约${Math.ceil(seconds / 3600)}小时`;
  }
}

// 格式化已用时间
export function formatElapsedTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}分钟`;
  } else {
    return `${Math.floor(seconds / 3600)}小时`;
  }
}

// 获取步骤状态
export function getStepStatus(
  stepId: string, 
  currentStep: string, 
  elapsedTime: number, 
  stepEstimatedTime: number,
  accumulatedTime: number
): 'pending' | 'active' | 'completed' | 'failed' {
  if (stepId === currentStep) {
    return 'active';
  }
  
  const stepStartTime = accumulatedTime;
  const stepEndTime = accumulatedTime + stepEstimatedTime;
  
  if (elapsedTime >= stepEndTime) {
    return 'completed';
  } else if (elapsedTime < stepStartTime) {
    return 'pending';
  } else {
    return 'active';
  }
}

// 计算步骤进度
export function getStepProgress(
  stepId: string,
  currentStep: string,
  elapsedTime: number,
  stepEstimatedTime: number,
  accumulatedTime: number
): number {
  if (stepId === currentStep) {
    const stepElapsed = elapsedTime - accumulatedTime;
    return Math.min(100, Math.max(0, (stepElapsed / stepEstimatedTime) * 100));
  }
  
  const stepStartTime = accumulatedTime;
  const stepEndTime = accumulatedTime + stepEstimatedTime;
  
  if (elapsedTime >= stepEndTime) {
    return 100;
  } else if (elapsedTime < stepStartTime) {
    return 0;
  } else {
    const stepElapsed = elapsedTime - stepStartTime;
    return (stepElapsed / stepEstimatedTime) * 100;
  }
}

// 获取基于实际数据的处理进度估算
export function getConservativeProcessingEstimate(
  elapsedTime: number,
  audioDuration?: number,
  textLength?: number
): ProcessingEstimate {
  const steps = [...PROCESSING_STEPS];
  
  // 根据音频时长调整ASR时间 - 使用保守估算
  if (audioDuration) {
    const asrStep = steps.find(step => step.id === 'asr');
    if (asrStep) {
      // 使用保守估算：3倍速处理，ASR占60%
      const totalProcessingTime = audioDuration / 3.0;
      asrStep.estimatedTime = Math.max(60, totalProcessingTime * 0.6);
    }
  }
  
  // 根据文本长度调整总结时间 - 使用保守估算
  if (textLength) {
    const summaryStep = steps.find(step => step.id === 'summarize');
    if (summaryStep) {
      // 使用保守估算：总结占15%
      const estimatedAudioDuration = textLength / 800; // 每分钟800字符
      const totalProcessingTime = estimatedAudioDuration * 60 / 3.0;
      summaryStep.estimatedTime = Math.max(30, totalProcessingTime * 0.15);
    }
  }
  
  const totalEstimatedTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);
  
  // 计算当前步骤和进度
  let currentStep = 'parse';
  let overallProgress = 0;
  let estimatedRemainingTime = totalEstimatedTime;
  
  let accumulatedTime = 0;
  for (const step of steps) {
    if (elapsedTime <= accumulatedTime + step.estimatedTime) {
      currentStep = step.id;
      const stepProgress = Math.min(1, (elapsedTime - accumulatedTime) / step.estimatedTime);
      overallProgress = accumulatedTime / totalEstimatedTime + (stepProgress * step.weight);
      estimatedRemainingTime = totalEstimatedTime - elapsedTime;
      break;
    }
    accumulatedTime += step.estimatedTime;
    overallProgress += step.weight;
  }
  
  // 如果超过总预计时间，标记为完成
  if (elapsedTime >= totalEstimatedTime) {
    currentStep = 'completed';
    overallProgress = 1;
    estimatedRemainingTime = 0;
  }
  
  return {
    steps,
    totalEstimatedTime,
    currentStep,
    overallProgress: Math.min(1, overallProgress),
    estimatedRemainingTime: Math.max(0, estimatedRemainingTime)
  };
}
