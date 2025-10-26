import { NextRequest } from 'next/server';
import { z } from 'zod';
import { generateReportWhole, canProcessAsWhole } from '@/clients/report-generator';
import { recordLLMUsage } from '@/server/monitoring';
import { setCachedAudio } from '@/server/audio-cache';

const bodySchema = z.object({
  transcript: z.string().min(1),
  originalTranscript: z.string().optional(),
  title: z.string().optional(),
  audioUrl: z.string().url().optional(), // 用于缓存
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    
    if (!parsed.success) {
      return Response.json({ 
        success: false, 
        error: "Invalid request body" 
      }, { status: 400 });
    }
    
    const { transcript, originalTranscript, title, audioUrl } = parsed.data;
    
    console.log(`开始整体生成访谈报告，文本长度: ${transcript.length} 字符`);
    
    // 检查是否适合整体处理
    const { canProcess, reason } = canProcessAsWhole(transcript);
    
    if (!canProcess) {
      return Response.json({
        success: false,
        error: `文本过长，不适合整体处理: ${reason}`
      }, { status: 400 });
    }
    
    // 执行整体处理
    const result = await generateReportWhole({ transcript, originalTranscript, title });
    
    console.log(`整体报告生成完成，总耗时: ${result.processingTime}ms`);
    
    // 记录LLM API使用情况
    await recordLLMUsage(result.estimatedTokens);
    
    // 缓存生成的报告
    if (audioUrl) {
      await setCachedAudio(audioUrl, { summary: result.summary });
    }
    
    return Response.json({
      success: true,
      summary: result.summary,
      stats: {
        originalLength: transcript.length,
        reportLength: result.summary.length,
        processingTime: result.processingTime,
        estimatedTokens: result.estimatedTokens,
        method: "whole",
        compressionRatio: (result.summary.length / transcript.length * 100).toFixed(1) + '%'
      }
    });
    
  } catch (error) {
    console.error('整体报告生成失败:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
