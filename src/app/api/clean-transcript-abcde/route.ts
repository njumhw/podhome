import { NextRequest } from 'next/server';
import { z } from 'zod';
import { cleanTranscriptWithABCDE } from '@/clients/transcript-cleaner-abcde';
import { recordLLMUsage } from '@/server/monitoring';
import { setCachedAudio } from '@/server/audio-cache';

const bodySchema = z.object({
  transcript: z.string().min(1),
  segments: z.array(z.string()).optional(), // 新增：ASR片段数组
  language: z.string().optional().default("zh"),
  audioUrl: z.string().url().optional()
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
    
    const { transcript, segments, language, audioUrl } = parsed.data;
    
    console.log(`开始ABCDE分块处理，文本长度: ${transcript.length} 字符`);
    if (segments) {
      console.log(`使用ASR片段数组，片段数: ${segments.length}`);
    }
    
    // 执行ABCDE分块处理
    const result = await cleanTranscriptWithABCDE({ transcript, segments, language, audioUrl });
    
    console.log(`ABCDE分块处理完成，总耗时: ${result.processingTime}ms`);
    console.log(`压缩比: ${(result.script.length / transcript.length * 100).toFixed(1)}%`);
    
    // 记录LLM API使用情况
    await recordLLMUsage(result.estimatedTokens);
    
    // 缓存生成的脚本（如果有audioUrl参数）
    if (audioUrl) {
      await setCachedAudio(audioUrl, { script: result.script });
    }
    
    return Response.json({
      success: true,
      script: result.script,
      chunksCount: result.chunks,
      stats: {
        originalLength: transcript.length,
        scriptLength: result.script.length,
        processingTime: result.processingTime,
        estimatedTokens: result.estimatedTokens,
        chunks: result.chunks,
        compressionRatio: (result.script.length / transcript.length * 100).toFixed(1) + '%',
        speakerLibrary: result.speakerLibrary
      }
    });
    
  } catch (error) {
    console.error('ABCDE分块处理失败:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
