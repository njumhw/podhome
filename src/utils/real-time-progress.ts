// 实时进度跟踪系统
import { db } from "@/server/db";

export interface RealTimeStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  actualDuration?: number; // 实际耗时（秒）
  estimatedDuration?: number; // 预计耗时（秒）
  progress: number; // 0-100
  error?: string;
}

export interface RealTimeProgress {
  podcastId: string;
  overallStatus: 'processing' | 'completed' | 'failed';
  overallProgress: number; // 0-100
  currentStep?: string;
  steps: RealTimeStep[];
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  estimatedRemainingTime?: number;
}

// 从TaskLog获取实际进度
export async function getRealTimeProgress(podcastId: string): Promise<RealTimeProgress | null> {
  try {
    // 获取任务日志
    const taskLogs = await db.taskLog.findMany({
      where: { podcastId },
      orderBy: { createdAt: 'asc' }
    });

    if (taskLogs.length === 0) {
      return null; // 没有使用新的pipeline系统
    }

    // 定义步骤映射
    const stepMapping = {
      'TRANSCRIBE': { id: 'asr', name: '语音转文字', description: '正在将音频转换为文字稿' },
      'CLEAN': { id: 'clean', name: '清理文字稿', description: '正在优化文字稿格式和内容' },
      'IDENTIFY': { id: 'identify', name: '识别说话人', description: '正在识别和标注不同说话人' },
      'SUMMARIZE': { id: 'summarize', name: '生成播客总结', description: '正在分析内容并生成播客总结' },
      'CHUNK': { id: 'chunk', name: '文本分块', description: '正在将文本分割为合适的块' },
      'EMBED': { id: 'embed', name: '向量化', description: '正在生成文本向量嵌入' }
    };

    // 构建步骤状态
    const steps: RealTimeStep[] = [];
    let overallProgress = 0;
    let currentStep: string | undefined;
    let overallStatus: 'processing' | 'completed' | 'failed' = 'processing';

    // 按步骤类型分组任务日志
    const stepGroups = new Map<string, any[]>();
    taskLogs.forEach(log => {
      if (!stepGroups.has(log.type)) {
        stepGroups.set(log.type, []);
      }
      stepGroups.get(log.type)!.push(log);
    });

    // 处理每个步骤
    for (const [stepType, logs] of stepGroups) {
      const stepInfo = stepMapping[stepType as keyof typeof stepMapping];
      if (!stepInfo) continue;

      const latestLog = logs[logs.length - 1]; // 获取最新的日志
      const startTime = logs[0].createdAt.getTime();
      const endTime = latestLog.status === 'SUCCESS' ? 
        (latestLog.createdAt.getTime() + (latestLog.durationMs || 0)) : undefined;
      
      let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
      let progress = 0;

      if (latestLog.status === 'SUCCESS') {
        status = 'completed';
        progress = 100;
      } else if (latestLog.status === 'FAILED') {
        status = 'failed';
        progress = 0;
      } else if (latestLog.status === 'RUNNING') {
        status = 'running';
        // 根据耗时估算进度
        const elapsed = Date.now() - startTime;
        const estimated = getEstimatedDuration(stepType);
        progress = Math.min(95, Math.round((elapsed / estimated) * 100));
        currentStep = stepInfo.id;
      }

      steps.push({
        id: stepInfo.id,
        name: stepInfo.name,
        description: stepInfo.description,
        status,
        startTime,
        endTime,
        actualDuration: endTime ? Math.round((endTime - startTime) / 1000) : undefined,
        estimatedDuration: getEstimatedDuration(stepType),
        progress,
        error: latestLog.error || undefined
      });
    }

    // 计算总体进度
    if (steps.length > 0) {
      const completedSteps = steps.filter(s => s.status === 'completed').length;
      const failedSteps = steps.filter(s => s.status === 'failed').length;
      
      if (failedSteps > 0) {
        overallStatus = 'failed';
        overallProgress = Math.round((completedSteps / steps.length) * 100);
      } else if (completedSteps === steps.length) {
        overallStatus = 'completed';
        overallProgress = 100;
      } else {
        overallStatus = 'processing';
        // 基于已完成步骤和当前步骤进度计算
        const baseProgress = (completedSteps / steps.length) * 100;
        const currentStepProgress = currentStep ? 
          steps.find(s => s.id === currentStep)?.progress || 0 : 0;
        overallProgress = Math.round(baseProgress + (currentStepProgress / steps.length));
      }
    }

    // 计算总耗时和预计剩余时间
    const startTime = Math.min(...steps.map(s => s.startTime || Date.now()));
    const endTime = overallStatus === 'completed' ? 
      Math.max(...steps.map(s => s.endTime || Date.now())) : undefined;
    const totalDuration = endTime ? Math.round((endTime - startTime) / 1000) : undefined;

    // 估算剩余时间
    let estimatedRemainingTime: number | undefined;
    if (overallStatus === 'processing') {
      const remainingSteps = steps.filter(s => s.status !== 'completed');
      estimatedRemainingTime = remainingSteps.reduce((sum, step) => {
        if (step.status === 'running') {
          return sum + (step.estimatedDuration || 0) * (1 - step.progress / 100);
        } else {
          return sum + (step.estimatedDuration || 0);
        }
      }, 0);
    }

    return {
      podcastId,
      overallStatus,
      overallProgress,
      currentStep,
      steps,
      startTime,
      endTime,
      totalDuration,
      estimatedRemainingTime
    };

  } catch (error) {
    console.error('获取实时进度失败:', error);
    return null;
  }
}

// 获取步骤的预计耗时 - 更保守的估算
function getEstimatedDuration(stepType: string): number {
  const estimates = {
    'TRANSCRIBE': 600, // 10分钟 - 更保守的估算
    'CLEAN': 120,      // 2分钟
    'IDENTIFY': 60,    // 1分钟
    'SUMMARIZE': 300,  // 5分钟 - 更保守的估算
    'CHUNK': 60,       // 1分钟
    'EMBED': 180       // 3分钟
  };
  return estimates[stepType as keyof typeof estimates] || 120;
}

// 格式化时间
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes}分钟`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}小时${minutes}分钟`;
  }
}

// 格式化剩余时间
export function formatRemainingTime(seconds: number): string {
  if (seconds < 60) {
    return `约${Math.round(seconds)}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `约${minutes}分钟`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `约${hours}小时${minutes}分钟`;
  }
}
