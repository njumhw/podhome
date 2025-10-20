// 数据一致性保障工具
import { db } from '@/server/db';

export interface DataConsistencyCheck {
  audioCacheId: string;
  hasTranscript: boolean;
  hasScript: boolean;
  hasSummary: boolean;
  summaryIsAI: boolean;
  summaryLength: number;
  issues: string[];
}

/**
 * 检查播客数据的一致性
 */
export async function checkPodcastDataConsistency(audioCacheId: string): Promise<DataConsistencyCheck> {
  const issues: string[] = [];
  
  try {
    const audioCache = await db.audioCache.findUnique({
      where: { id: audioCacheId },
      select: {
        id: true,
        title: true,
        transcript: true,
        summary: true,
        audioUrl: true
      }
    });

    if (!audioCache) {
      return {
        audioCacheId,
        hasTranscript: false,
        hasScript: false,
        hasSummary: false,
        summaryIsAI: false,
        summaryLength: 0,
        issues: ['播客记录不存在']
      };
    }

    const hasTranscript = !!audioCache.transcript && audioCache.transcript.length > 0;
    const hasScript = !!audioCache.script && audioCache.script.length > 0;
    const hasSummary = !!audioCache.summary && audioCache.summary.length > 0;
    
    // 检查总结是否为AI生成
    const summaryIsAI = hasSummary && (
      audioCache.summary.includes('播客访谈报告') ||
      audioCache.summary.includes('访谈概述') ||
      audioCache.summary.includes('核心观点') ||
      audioCache.summary.includes('关键洞察')
    );

    // 检查是否为网页简介
    const isWebDescription = hasSummary && (
      audioCache.summary.includes('本期嘉宾') ||
      audioCache.summary.includes('时间线') ||
      audioCache.summary.includes('主播') ||
      audioCache.summary.includes('开场&结尾音乐')
    );

    if (!hasTranscript) issues.push('缺少转录文本');
    if (!hasScript) issues.push('缺少清理后的文本');
    if (!hasSummary) issues.push('缺少播客总结');
    if (hasSummary && !summaryIsAI && !isWebDescription) issues.push('总结内容格式异常');
    if (isWebDescription) issues.push('总结内容是网页简介而非AI生成');

    return {
      audioCacheId,
      hasTranscript,
      hasScript,
      hasSummary,
      summaryIsAI,
      summaryLength: audioCache.summary?.length || 0,
      issues
    };

  } catch (error) {
    return {
      audioCacheId,
      hasTranscript: false,
      hasScript: false,
      hasSummary: false,
      summaryIsAI: false,
      summaryLength: 0,
      issues: [`检查失败: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * 自动修复数据一致性问题
 */
export async function autoFixDataConsistency(audioCacheId: string): Promise<boolean> {
  try {
    const check = await checkPodcastDataConsistency(audioCacheId);
    
    if (check.issues.length === 0) {
      console.log(`✅ 播客 ${audioCacheId} 数据一致性正常`);
      return true;
    }

    console.log(`🔧 开始修复播客 ${audioCacheId} 的数据一致性问题:`, check.issues);

    // 如果有转录文本但没有AI总结，尝试生成总结
    if (check.hasScript && !check.summaryIsAI) {
      console.log('🔄 尝试重新生成AI总结...');
      
      const audioCache = await db.audioCache.findUnique({
        where: { id: audioCacheId },
        select: { transcript: true, title: true, audioUrl: true }
      });

      if (audioCache?.transcript) {
        try {
          // 调用总结生成API
          const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: audioCache.transcript,
              title: audioCache.title,
              audioUrl: audioCache.audioUrl
            })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.summary) {
              await db.audioCache.update({
                where: { id: audioCacheId },
                data: { summary: result.summary }
              });
              console.log('✅ AI总结生成成功');
              return true;
            }
          }
        } catch (error) {
          console.error('❌ 总结生成失败:', error);
        }
      }
    }

    return false;
  } catch (error) {
    console.error('❌ 数据一致性修复失败:', error);
    return false;
  }
}

/**
 * 批量检查所有播客的数据一致性
 */
export async function batchCheckDataConsistency(): Promise<DataConsistencyCheck[]> {
  try {
    const audioCaches = await db.audioCache.findMany({
      select: { id: true }
    });

    const results: DataConsistencyCheck[] = [];
    
    for (const audioCache of audioCaches) {
      const check = await checkPodcastDataConsistency(audioCache.id);
      results.push(check);
    }

    return results;
  } catch (error) {
    console.error('批量检查失败:', error);
    return [];
  }
}
