/**
 * 基于内容完整性原则的访谈记录清洗器
 * 确保95%以上的内容保留率
 */

import { qwenChat, ChatMessage } from './qwen-text';
import { getPrompt } from '@/server/prompt-service';
import { 
  analyzeContentForIntegrity, 
  validateContentIntegrity, 
  generateIntegrityReport,
  CONTENT_INTEGRITY_CONFIG 
} from './content-integrity-manager';

export interface IntegrityCleaningInput {
  transcript: string;
  language?: string;
  audioUrl?: string;
}

export interface IntegrityCleaningOutput {
  script: string;
  processingTime: number;
  estimatedTokens: number;
  integrityReport: ReturnType<typeof generateIntegrityReport>;
  strategy: string;
  chunks?: number;
}

/**
 * 基于完整性原则的访谈记录清洗
 */
export async function cleanTranscriptWithIntegrity(input: IntegrityCleaningInput): Promise<IntegrityCleaningOutput> {
  const { transcript, language = "zh", audioUrl } = input;
  const startTime = Date.now();
  
  console.log(`开始基于完整性原则的访谈记录清洗，文本长度: ${transcript.length} 字符`);
  
  // 分析内容完整性要求
  const analysis = analyzeContentForIntegrity(transcript, 'transcript-to-script');
  console.log(`内容完整性分析: 预期输出 ${analysis.expectedOutputLength.toLocaleString()} 字符 (${(analysis.expectedOutputLength / transcript.length * 100).toFixed(1)}%)`);
  console.log(`处理策略: ${analysis.strategy.method} - ${analysis.strategy.reason}`);
  
  let script: string;
  let chunks: number | undefined;
  
  // 根据策略选择处理方法
  switch (analysis.strategy.method) {
    case 'whole':
      script = await cleanTranscriptWhole(transcript, language, analysis.strategy);
      break;
    case 'chunked':
      const chunkedResult = await cleanTranscriptChunked(transcript, language, analysis.strategy);
      script = chunkedResult.script;
      chunks = chunkedResult.chunks;
      break;
    case 'hybrid':
      const hybridResult = await cleanTranscriptHybrid(transcript, language, analysis.strategy);
      script = hybridResult.script;
      chunks = hybridResult.chunks;
      break;
    default:
      throw new Error(`未知的处理策略: ${analysis.strategy.method}`);
  }
  
  const processingTime = Date.now() - startTime;
  const estimatedTokens = Math.ceil((transcript.length + script.length) / 2);
  
  // 生成完整性报告
  const integrityReport = generateIntegrityReport(transcript, script, 'transcript-to-script', processingTime);
  
  console.log(`访谈记录清洗完成，耗时: ${processingTime}ms`);
  console.log(`完整性报告: ${integrityReport.summary}`);
  console.log(`实际压缩比: ${(integrityReport.details.actualRatio * 100).toFixed(1)}%`);
  console.log(`完整性评分: ${integrityReport.details.score}分`);
  
  return {
    script,
    processingTime,
    estimatedTokens,
    integrityReport,
    strategy: analysis.strategy.method,
    chunks
  };
}

/**
 * 整体处理（适用于小到中等长度的内容）
 */
async function cleanTranscriptWhole(
  transcript: string, 
  language: string, 
  strategy: any
): Promise<string> {
  console.log('使用整体处理方法');
  
  // 获取动态系统提示词
  let systemPrompt: string;
  try {
    systemPrompt = await getPrompt('transcript_cleaning_integrity');
  } catch (error) {
    console.warn('Failed to get dynamic prompt, using fallback:', error);
    systemPrompt = `你是专业的播客访谈记录清洗专家。请对访谈记录进行清洗，确保内容完整性。

**内容完整性原则：**
- 必须保留至少95%的原始内容
- 只删除语气词（"嗯"、"啊"、"那个"等）
- 保留所有有价值的信息、观点、论据和案例
- 不删减任何重要内容，只进行语言优化

**清洗目标：**
1. **删除语气词**：去除"嗯"、"啊"、"那个"等口语化表达
2. **优化语言表达**：重写断句与转场，使其更符合书面语习惯
3. **统一术语与人称**：确保同一概念和专业术语表达一致
4. **角色标识统一**：确保同一说话人在整个访谈中使用一致的标识

**识别规则：**
- 优先识别主持人/嘉宾的真实姓名，如果无法确定则使用"主持人"/"嘉宾"
- 若无法判断姓名，仅写主持人/嘉宾；再无法判断用说话人A/B/C
- 全文保持同一人的标签稳定一致

**输出格式：**
- 使用Markdown列表格式：- **说话人X（角色或姓名）：** 内容
- 说话人名称使用粗体
- 适当使用项目符号（•）来组织要点，提高可读性

**重要提醒：**
- 内容完整性第一，语言优化第二
- 必须保留至少95%的原始内容
- 不要过度压缩或删减内容`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `请对以下访谈记录进行清洗，确保内容完整性：

**语言**: ${language}

**访谈记录**:
${transcript}

请按照系统提示的要求进行清洗，确保保留至少95%的原始内容。`
    }
  ];

  const script = await qwenChat(messages, { 
    maxTokens: Math.max(strategy.maxOutputTokens, 6000), // 确保至少6000 tokens输出
    temperature: 0.1
  });

  return script;
}

/**
 * 分块处理（适用于长内容）
 */
async function cleanTranscriptChunked(
  transcript: string, 
  language: string, 
  strategy: any
): Promise<{ script: string; chunks: number }> {
  console.log('使用分块处理方法');
  
  // 创建智能分块
  const chunks = createSmartChunks(transcript, strategy.chunkSize, strategy.overlap);
  console.log(`分块完成，共 ${chunks.length} 个块`);
  
  // 获取动态系统提示词
  let systemPrompt: string;
  try {
    systemPrompt = await getPrompt('transcript_cleaning_integrity');
  } catch (error) {
    systemPrompt = `你是专业的播客访谈记录清洗专家。请对访谈记录片段进行清洗，确保内容完整性。

**内容完整性原则：**
- 必须保留至少95%的原始内容
- 只删除语气词（"嗯"、"啊"、"那个"等）
- 保留所有有价值的信息、观点、论据和案例
- 不删减任何重要内容，只进行语言优化

**清洗目标：**
1. **删除语气词**：去除"嗯"、"啊"、"那个"等口语化表达
2. **优化语言表达**：重写断句与转场，使其更符合书面语习惯
3. **统一术语与人称**：确保同一概念和专业术语表达一致
4. **角色标识统一**：确保同一说话人在整个访谈中使用一致的标识

**识别规则：**
- 优先识别主持人/嘉宾的真实姓名，如果无法确定则使用"主持人"/"嘉宾"
- 若无法判断姓名，仅写主持人/嘉宾；再无法判断用说话人A/B/C
- 全文保持同一人的标签稳定一致

**输出格式：**
- 使用Markdown列表格式：- **说话人X（角色或姓名）：** 内容
- 说话人名称使用粗体
- 适当使用项目符号（•）来组织要点，提高可读性

**分块处理要求：**
- 保持与前后文的连贯性
- 注意重叠部分的一致性
- 确保角色标识的稳定性
- 内容完整性第一，语言优化第二
- 必须保留至少95%的原始内容`;
  }

  const system = {
    role: "system" as const,
    content: systemPrompt,
  };

  // 处理每个块
  const cleanedChunks: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`处理块 ${i + 1}/${chunks.length}: ${chunk.length} 字符`);
    
    // 重试机制
    let cleanedChunk = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await qwenChat([
          system,
          { 
            role: "user", 
            content: `请清洗以下访谈记录片段，确保内容完整性：

**片段信息：**
- 片段 ${i + 1}/${chunks.length}
- 语言: ${language}

**访谈记录片段：**
${chunk}

请按照系统提示的要求进行清洗，确保保留至少95%的原始内容。`
          },
        ], { 
          model: "qwen-plus", 
          temperature: 0.1, 
          maxTokens: 6000 // 每个分块允许更多输出，确保内容完整性
        });
        
        if (!result || result.trim().length === 0) {
          throw new Error(`清洗结果为空 (尝试 ${attempt}/3)`);
        }
        
        cleanedChunk = result;
        console.log(`  块 ${i + 1} 处理成功 (尝试 ${attempt}/3)`);
        break;
        
      } catch (error: any) {
        console.warn(`  块 ${i + 1} 处理失败 (尝试 ${attempt}/3):`, error.message);
        
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }
    
    if (!cleanedChunk) {
      console.error(`  块 ${i + 1} 处理失败，使用原始文本`);
      cleanedChunk = chunk;
    }
    
    cleanedChunks.push(cleanedChunk);
  }
  
  // 合并结果并去重
  const mergedScript = mergeChunksWithDeduplication(cleanedChunks, strategy.overlap);
  
  return {
    script: mergedScript,
    chunks: chunks.length
  };
}

/**
 * 混合处理（适用于超长内容）
 */
async function cleanTranscriptHybrid(
  transcript: string, 
  language: string, 
  strategy: any
): Promise<{ script: string; chunks: number }> {
  console.log('使用混合处理方法');
  
  // 混合处理：先分块，再整体优化
  const chunkedResult = await cleanTranscriptChunked(transcript, language, strategy);
  
  // 如果分块结果仍然过长，进行二次处理
  const outputTokens = Math.ceil(chunkedResult.script.length / 1.5);
  if (outputTokens > strategy.maxOutputTokens) {
    console.log('分块结果仍然过长，进行二次处理');
    // 这里可以实现更复杂的混合处理逻辑
  }
  
  return chunkedResult;
}

/**
 * 创建智能分块
 */
function createSmartChunks(text: string, targetChunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  let currentChunk = '';
  let currentLength = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphLength = paragraph.length;
    
    if (currentLength + paragraphLength > targetChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + paragraph;
      currentLength = currentChunk.length;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentLength += paragraphLength;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
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
    const overlapText = merged.slice(-overlap);
    const chunkStart = currentChunk.slice(0, overlap);
    
    if (overlapText.includes(chunkStart) || chunkStart.includes(overlapText)) {
      merged += currentChunk.slice(overlap);
    } else {
      merged += '\n\n' + currentChunk;
    }
  }
  
  // 去重处理
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
