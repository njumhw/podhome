import { NextRequest } from 'next/server';
import { z } from 'zod';
import { cleanTranscriptWhole, canCleanAsWhole } from '@/clients/transcript-cleaner-whole';
import { recordLLMUsage } from '@/server/monitoring';
import { setCachedAudio } from '@/server/audio-cache';

const bodySchema = z.object({
  transcript: z.string().min(1),
  language: z.string().optional().default("zh"),
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
    
    const { transcript, language, audioUrl } = parsed.data;
    
    console.log(`开始整体清洗访谈记录，文本长度: ${transcript.length} 字符`);
    
    // 检查是否适合整体处理
    const { canClean, reason } = canCleanAsWhole(transcript);
    
    if (!canClean) {
      return Response.json({
        success: false,
        error: `文本过长，不适合整体处理: ${reason}`
      }, { status: 400 });
    }
    
    // 执行整体处理
    const result = await cleanTranscriptWhole({ transcript, language, audioUrl });
    
    console.log(`整体访谈记录清洗完成，总耗时: ${result.processingTime}ms`);
    
    // 记录LLM API使用情况
    await recordLLMUsage(result.estimatedTokens);
    
    // 缓存生成的脚本（如果有audioUrl参数）
    if (audioUrl) {
      await setCachedAudio(audioUrl, { script: result.script });
    }
    
    return Response.json({
      success: true,
      script: result.script,
      stats: {
        originalLength: transcript.length,
        scriptLength: result.script.length,
        processingTime: result.processingTime,
        estimatedTokens: result.estimatedTokens,
        method: "whole",
        compressionRatio: (result.script.length / transcript.length * 100).toFixed(1) + '%'
      }
    });
    
  } catch (error) {
    console.error('整体访谈记录清洗失败:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
