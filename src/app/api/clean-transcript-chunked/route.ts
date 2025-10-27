import { NextRequest } from 'next/server';
import { z } from 'zod';
import { cleanTranscriptChunked, cleanTranscriptSmart } from '@/clients/transcript-cleaner-chunked';
import { recordLLMUsage } from '@/server/monitoring';
import { setCachedAudio } from '@/server/audio-cache';

const bodySchema = z.object({
  transcript: z.string().min(1),
  language: z.string().optional().default("zh"),
  audioUrl: z.string().url().optional(),
  chunkSize: z.number().optional().default(12000),
  overlap: z.number().optional().default(1500),
  strategy: z.enum(['chunked', 'smart']).optional().default('smart')
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
    
    const { transcript, language, audioUrl, chunkSize, overlap, strategy } = parsed.data;
    
    console.log(`开始分块清洗访谈记录，文本长度: ${transcript.length} 字符，策略: ${strategy}`);
    
    // 选择处理策略
    let result;
    if (strategy === 'smart') {
      result = await cleanTranscriptSmart({ transcript, language, audioUrl, chunkSize, overlap });
    } else {
      result = await cleanTranscriptChunked({ transcript, language, audioUrl, chunkSize, overlap });
    }
    
    console.log(`分块访谈记录清洗完成，总耗时: ${result.processingTime}ms`);
    console.log(`质量评分: ${(result.qualityScore * 100).toFixed(1)}%，问题: ${result.issues.length} 个`);
    
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
        chunks: result.chunks,
        qualityScore: result.qualityScore,
        issues: result.issues,
        method: strategy,
        compressionRatio: (result.script.length / transcript.length * 100).toFixed(1) + '%'
      }
    });
    
  } catch (error) {
    console.error('分块访谈记录清洗失败:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

