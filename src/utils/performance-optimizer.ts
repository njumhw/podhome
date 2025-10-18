// 性能优化工具
import { db } from '@/server/db';

export interface PerformanceMetrics {
  audioDuration: number; // 音频时长（秒）
  processingTime: number; // 实际处理时间（秒）
  processingSpeed: number; // 处理速度倍数
  asrTime: number; // ASR处理时间（秒）
  summaryTime: number; // 总结生成时间（秒）
  totalSteps: number; // 总步骤数
  completedSteps: number; // 完成步骤数
  efficiency: number; // 效率评分 (0-100)
}

export interface OptimizationSuggestion {
  type: 'asr' | 'summary' | 'overall' | 'concurrency';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedImprovement: string;
}

// 分析处理性能
export async function analyzeProcessingPerformance(
  audioCacheId: string
): Promise<PerformanceMetrics | null> {
  try {
    const audioCache = await db.audioCache.findUnique({
      where: { id: audioCacheId },
      select: {
        duration: true,
        createdAt: true,
        updatedAt: true,
        transcript: true,
        script: true,
        summary: true
      }
    });

    if (!audioCache || !audioCache.duration) {
      return null;
    }

    const audioDuration = audioCache.duration;
    const processingTime = Math.round(
      (audioCache.updatedAt.getTime() - audioCache.createdAt.getTime()) / 1000
    );
    const processingSpeed = audioDuration / processingTime;

    // 估算各步骤时间（基于实际观察）
    const asrTime = Math.round(processingTime * 0.6); // ASR占60%
    const summaryTime = Math.round(processingTime * 0.15); // 总结占15%

    // 计算效率评分
    const targetSpeed = 3.0; // 目标3倍速
    const efficiency = Math.min(100, (processingSpeed / targetSpeed) * 100);

    return {
      audioDuration,
      processingTime,
      processingSpeed,
      asrTime,
      summaryTime,
      totalSteps: 6, // 解析、下载、ASR、清理、总结、完成
      completedSteps: 6, // 假设都完成了
      efficiency
    };
  } catch (error) {
    console.error('性能分析失败:', error);
    return null;
  }
}

// 获取性能优化建议
export function getOptimizationSuggestions(
  metrics: PerformanceMetrics
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // ASR性能优化
  if (metrics.processingSpeed < 2.0) {
    suggestions.push({
      type: 'asr',
      priority: 'high',
      description: 'ASR处理速度较慢，建议优化音频切分策略',
      expectedImprovement: '提升20-30%处理速度'
    });
  }

  // 总结生成优化
  if (metrics.summaryTime > metrics.audioDuration * 0.1) {
    suggestions.push({
      type: 'summary',
      priority: 'medium',
      description: '总结生成时间过长，建议优化LLM调用策略',
      expectedImprovement: '减少50%总结时间'
    });
  }

  // 整体性能优化
  if (metrics.efficiency < 80) {
    suggestions.push({
      type: 'overall',
      priority: 'high',
      description: '整体处理效率偏低，建议启用并发处理',
      expectedImprovement: '提升40-60%处理速度'
    });
  }

  // 并发处理建议
  if (metrics.processingSpeed < 3.0) {
    suggestions.push({
      type: 'concurrency',
      priority: 'medium',
      description: '建议启用多任务并发处理',
      expectedImprovement: '支持同时处理3个播客'
    });
  }

  return suggestions;
}

// 批量分析性能
export async function batchAnalyzePerformance(
  limit: number = 10
): Promise<PerformanceMetrics[]> {
  try {
    const audioCaches = await db.audioCache.findMany({
      where: {
        duration: { not: null },
        transcript: { not: null },
        script: { not: null }
      },
      select: {
        id: true,
        duration: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });

    const results: PerformanceMetrics[] = [];
    
    for (const cache of audioCaches) {
      const metrics = await analyzeProcessingPerformance(cache.id);
      if (metrics) {
        results.push(metrics);
      }
    }

    return results;
  } catch (error) {
    console.error('批量性能分析失败:', error);
    return [];
  }
}

// 计算平均性能指标
export function calculateAverageMetrics(
  metrics: PerformanceMetrics[]
): {
  averageSpeed: number;
  averageEfficiency: number;
  totalProcessed: number;
  recommendations: string[];
} {
  if (metrics.length === 0) {
    return {
      averageSpeed: 0,
      averageEfficiency: 0,
      totalProcessed: 0,
      recommendations: []
    };
  }

  const averageSpeed = metrics.reduce((sum, m) => sum + m.processingSpeed, 0) / metrics.length;
  const averageEfficiency = metrics.reduce((sum, m) => sum + m.efficiency, 0) / metrics.length;

  const recommendations: string[] = [];
  
  if (averageSpeed < 2.0) {
    recommendations.push('整体处理速度偏慢，建议优化ASR和总结生成流程');
  }
  
  if (averageEfficiency < 80) {
    recommendations.push('处理效率有待提升，建议启用并发处理和缓存优化');
  }
  
  if (averageSpeed >= 3.0) {
    recommendations.push('处理性能良好，已达到3倍速目标');
  }

  return {
    averageSpeed,
    averageEfficiency,
    totalProcessed: metrics.length,
    recommendations
  };
}