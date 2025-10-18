import { NextRequest } from 'next/server';
import { z } from 'zod';
import { cleanTranscriptWithIntegrity } from '@/clients/transcript-cleaner-integrity';
import { recordLLMUsage } from '@/server/monitoring';
import { setCachedAudio } from '@/server/audio-cache';

const bodySchema = z.object({
  transcript: z.string().min(1),
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
    
    const { transcript, language, audioUrl } = parsed.data;
    
    console.log(`开始基于完整性原则的访谈记录清洗，文本长度: ${transcript.length} 字符`);
    
    // 执行基于完整性原则的清洗
    const result = await cleanTranscriptWithIntegrity({ transcript, language, audioUrl });
    
    console.log(`访谈记录清洗完成，总耗时: ${result.processingTime}ms`);
    console.log(`完整性报告: ${result.integrityReport.summary}`);
    
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
        strategy: result.strategy,
        chunks: result.chunks,
        integrityReport: result.integrityReport,
        compressionRatio: (result.script.length / transcript.length * 100).toFixed(1) + '%'
      }
    });
    
  } catch (error) {
    console.error('基于完整性原则的访谈记录清洗失败:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
