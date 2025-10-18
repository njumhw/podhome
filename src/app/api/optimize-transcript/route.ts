import { NextRequest } from 'next/server';
import { z } from 'zod';
import { optimizeTranscript, optimizeTranscriptInChunks, canOptimizeAsWhole } from '@/clients/transcript-optimizer';
import { recordLLMUsage } from '@/server/monitoring';

const bodySchema = z.object({
  transcript: z.string().min(1),
  title: z.string().optional(),
  audioUrl: z.string().url().optional(), // 用于缓存
  forceChunked: z.boolean().optional() // 强制使用分段优化
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
    
    const { transcript, title, audioUrl, forceChunked } = parsed.data;
    
    console.log(`开始优化访谈记录，文本长度: ${transcript.length} 字符`);
    
    // 检查是否适合整体优化
    const { canOptimize, reason } = canOptimizeAsWhole(transcript);
    
    let result;
    let method: string;
    
    if (forceChunked || !canOptimize) {
      console.log(`使用分段优化${reason ? `: ${reason}` : '（强制）'}`);
      result = await optimizeTranscriptInChunks(transcript, title);
      method = "chunked";
    } else {
      console.log('使用整体优化');
      result = await optimizeTranscript({ transcript, title });
      method = "whole";
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`访谈记录优化完成，总耗时: ${processingTime}ms`);
    
    // 记录LLM API使用情况
    const estimatedTokens = Math.ceil((transcript.length + result.optimizedTranscript.length) / 2);
    await recordLLMUsage(estimatedTokens);
    
    return Response.json({
      success: true,
      ...result,
      stats: {
        originalLength: transcript.length,
        optimizedLength: result.optimizedTranscript.length,
        processingTime,
        estimatedTokens,
        method,
        canOptimizeAsWhole: canOptimize,
        reason
      }
    });
    
  } catch (error) {
    console.error('访谈记录优化失败:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
