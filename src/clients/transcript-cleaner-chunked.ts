/**
 * 分块清洗访谈记录（质量优先方案）
 * 确保长播客也能输出高质量结果
 */

import { qwenChat, ChatMessage } from './qwen-text';
import { getPrompt } from '@/server/prompt-service';
import { validateOutputQuality } from './output-limiter';

export interface ChunkedCleaningInput {
  transcript: string;
  language?: string;
  audioUrl?: string;
  chunkSize?: number;
  overlap?: number;
}

export interface ChunkedCleaningOutput {
  script: string;
  processingTime: number;
  estimatedTokens: number;
  chunks: number;
  qualityScore: number;
  issues: string[];
}

/**
 * 智能分块策略
 * 根据内容特点选择最佳分块方式
 */
function createSmartChunks(text: string, targetChunkSize: number = 12000, overlap: number = 1500): string[] {
  const chunks: string[] = [];
  
  // 按段落分割，保持语义完整性
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  let currentChunk = '';
  let currentLength = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphLength = paragraph.length;
    
    // 如果添加这个段落会超过目标大小，先保存当前块
    if (currentLength + paragraphLength > targetChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      
      // 创建重叠部分（从当前块的末尾开始）
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + paragraph;
      currentLength = currentChunk.length;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentLength += paragraphLength;
    }
  }
  
  // 添加最后一个块
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * 高质量分块清洗
 */
export async function cleanTranscriptChunked(input: ChunkedCleaningInput): Promise<ChunkedCleaningOutput> {
  const { transcript, language = "zh", audioUrl, chunkSize = 12000, overlap = 1500 } = input;
  const startTime = Date.now();
  
  console.log(`开始分块清洗访谈记录，文本长度: ${transcript.length} 字符`);
  
  // 创建智能分块
  const chunks = createSmartChunks(transcript, chunkSize, overlap);
  console.log(`分块完成，共 ${chunks.length} 个块`);
  
  // 获取动态系统提示词
  let systemPrompt: string;
  try {
    systemPrompt = await getPrompt('transcript_cleaning_chunked');
  } catch (error) {
    console.warn('Failed to get dynamic prompt, using fallback:', error);
    systemPrompt = `你是专业的播客访谈记录清洗专家。请对访谈记录片段进行高质量清洗，确保角色标识和专业术语的一致性。

**清洗目标：**
1. **删除赘词与口头禅**：去除"嗯"、"啊"、"那个"等口语化表达
2. **重写断句与转场**：优化语言表达，使其更符合书面语习惯
3. **统一术语与人称**：确保同一概念和专业术语表达一致
4. **角色标识统一**：确保同一说话人在整个访谈中使用一致的标识
5. **保持内容完整性**：不删减任何重要内容，只进行语言优化

**重要：内容完整性优先**
- 必须保留所有重要观点、论据和案例
- 不要过度压缩或删减内容
- 保持原有的信息密度和详细程度
- 只进行语言优化，不改变内容结构

**识别规则：**
- 优先识别主持人/嘉宾的真实姓名，如果无法确定则使用"主持人"/"嘉宾"
- 若无法判断姓名，仅写主持人/嘉宾；再无法判断用说话人A/B/C
- 全文保持同一人的标签稳定一致

**输出格式：**
- 使用Markdown列表格式：- **说话人X（角色或姓名）：** 内容
- 说话人名称使用粗体
- 适当使用项目符号（•）来组织要点，提高可读性
- 在列举多个观点、论据或案例时使用项目符号
- 项目符号不要过于频繁，主要用于关键信息的分组

**分块处理要求：**
- 保持与前后文的连贯性
- 注意重叠部分的一致性
- 确保角色标识的稳定性
- 内容完整性第一，语言优化第二`;
  }

  const system = {
    role: "system" as const,
    content: systemPrompt,
  };

  // 处理每个块
  const cleanedChunks: string[] = [];
  const allIssues: string[] = [];
  let totalQualityScore = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`处理块 ${i + 1}/${chunks.length}: ${chunk.length} 字符`);
    
    // 重试机制：最多重试3次
    let lastError: any = null;
    let cleanedChunk = '';
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await qwenChat([
          system,
          { 
            role: "user", 
            content: `请清洗以下访谈记录片段，删除赘词与口头禅，重写断句与转场，统一术语与人称，不改变事实。

**片段信息：**
- 片段 ${i + 1}/${chunks.length}
- 语言: ${language}

**访谈记录片段：**
${chunk}

请按照系统提示的要求进行清洗，确保角色标识和专业术语的一致性。`
          },
        ], { 
          model: "qwen-plus", 
          temperature: 0.1, 
          maxTokens: 6000 // 增加输出限制，确保内容完整性
        });
        
        // 验证结果
        if (!result || result.trim().length === 0) {
          throw new Error(`清洗结果为空 (尝试 ${attempt}/3)`);
        }
        
        cleanedChunk = result;
        console.log(`  块 ${i + 1} 处理成功 (尝试 ${attempt}/3)`);
        break;
        
      } catch (error: any) {
        lastError = error;
        console.warn(`  块 ${i + 1} 处理失败 (尝试 ${attempt}/3):`, error.message);
        
        if (attempt < 3) {
          // 指数退避重试
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }
    
    // 如果所有重试都失败了，使用原始文本
    if (!cleanedChunk) {
      console.error(`  块 ${i + 1} 处理失败，使用原始文本`);
      cleanedChunk = chunk;
      allIssues.push(`块 ${i + 1} 处理失败，使用原始文本`);
    }
    
    // 质量检查 - 使用更严格的标准
    const qualityCheck = validateOutputQuality(chunk, cleanedChunk, 0.3);
    totalQualityScore += qualityCheck.isValid ? 1 : 0.5;
    
    if (!qualityCheck.isValid) {
      allIssues.push(`块 ${i + 1}: ${qualityCheck.issues.join(', ')}`);
    }
    
    cleanedChunks.push(cleanedChunk);
  }
  
  // 合并结果并去重
  const mergedScript = mergeChunksWithDeduplication(cleanedChunks, overlap);
  
  const processingTime = Date.now() - startTime;
  const estimatedTokens = Math.ceil((transcript.length + mergedScript.length) / 2);
  const qualityScore = totalQualityScore / chunks.length;
  
  console.log(`分块访谈记录清洗完成，耗时: ${processingTime}ms，Token估算: ${estimatedTokens}`);
  console.log(`质量评分: ${(qualityScore * 100).toFixed(1)}%，问题: ${allIssues.length} 个`);
  
  return {
    script: mergedScript,
    processingTime,
    estimatedTokens,
    chunks: chunks.length,
    qualityScore,
    issues: allIssues
  };
}

/**
 * 合并分块结果并去重
 */
function mergeChunksWithDeduplication(chunks: string[], overlap: number): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0];
  
  let merged = chunks[0];
  
  for (let i = 1; i < chunks.length; i++) {
    const currentChunk = chunks[i];
    
    // 检查重叠部分
    const overlapText = merged.slice(-overlap);
    const chunkStart = currentChunk.slice(0, overlap);
    
    // 如果重叠部分相似，则跳过重叠部分
    if (overlapText.includes(chunkStart) || chunkStart.includes(overlapText)) {
      merged += currentChunk.slice(overlap);
    } else {
      // 否则直接拼接
      merged += '\n\n' + currentChunk;
    }
  }
  
  // 去重处理：移除重复的段落
  const paragraphs = merged.split('\n\n').filter(p => p.trim());
  const uniqueParagraphs: string[] = [];
  const seen = new Set<string>();
  
  for (const paragraph of paragraphs) {
    const normalized = paragraph.trim().toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueParagraphs.push(paragraph);
    }
  }
  
  return uniqueParagraphs.join('\n\n');
}

/**
 * 智能选择处理策略
 */
export async function cleanTranscriptSmart(input: ChunkedCleaningInput): Promise<ChunkedCleaningOutput> {
  const { transcript } = input;
  
  // 分析输出限制
  const inputTokens = Math.ceil(transcript.length / 1.5);
  const expectedOutputTokens = Math.ceil(inputTokens * 0.7);
  const maxOutputTokens = 8000;
  
  if (expectedOutputTokens <= maxOutputTokens) {
    // 如果预期输出在限制内，尝试整体处理
    try {
      const { cleanTranscriptWhole } = await import('./transcript-cleaner-whole');
      const result = await cleanTranscriptWhole(input);
      
      return {
        script: result.script,
        processingTime: result.processingTime,
        estimatedTokens: result.estimatedTokens,
        chunks: 1,
        qualityScore: 1.0,
        issues: []
      };
    } catch (error) {
      console.warn('整体处理失败，回退到分块处理:', error);
    }
  }
  
  // 使用分块处理
  return await cleanTranscriptChunked(input);
}
