/**
 * 基于ABCDE分块策略的访谈记录清洗器
 * A块: 生成角色库 + 清洗内容
 * BCDE块: 基于角色库并行处理
 */

import { qwenChat, ChatMessage } from './qwen-text';

export interface ABCDEProcessingInput {
  transcript: string;
  segments?: string[];  // 新增：ASR片段数组
  language?: string;
  audioUrl?: string;
}

export interface ABCDEProcessingOutput {
  script: string;
  processingTime: number;
  estimatedTokens: number;
  chunks: number;
  speakerLibrary: string;
}

/**
 * 基于ABCDE策略的访谈记录清洗
 */
export async function cleanTranscriptWithABCDE(input: ABCDEProcessingInput): Promise<ABCDEProcessingOutput> {
  const { transcript, segments, language = "zh", audioUrl } = input;
  const startTime = Date.now();
  
  console.log(`开始ABCDE分块处理，文本长度: ${transcript.length} 字符`);
  console.log(`ASR片段数组: ${segments ? `${segments.length}个片段` : '未提供'}`);
  
  // 优先使用片段数组进行分块，如果没有则使用转录文本
  let chunks: string[];
  if (segments && segments.length > 0) {
    console.log('✅ 使用ASR片段数组进行分块');
    chunks = createABCDEChunksFromSegments(segments);
  } else {
    console.log('⚠️ ASR片段数组不可用，使用转录文本进行分块');
    chunks = createABCDEChunks(transcript);
  }
  
  console.log(`分块完成，共 ${chunks.length} 个块: ${chunks.map((c, i) => `${String.fromCharCode(65 + i)}(${c.length}字符)`).join(', ')}`);
  
  if (chunks.length === 0) {
    throw new Error('无法创建有效的分块');
  }
  
  // 步骤1: 处理A块 (生成角色库 + 清洗内容)
  console.log('处理A块: 生成角色库 + 清洗内容');
  const aBlockResult = await processABlock(chunks[0], language);
  
  // 步骤2: 并行处理BCDE块
  console.log(`并行处理${chunks.length - 1}个后续块`);
  console.log(`角色库长度: ${aBlockResult.speakerLibrary.length}字符`);
  console.log(`角色库内容: ${aBlockResult.speakerLibrary.substring(0, 200)}...`);
  
  const otherBlocks = chunks.slice(1);
  const otherBlockResults = otherBlocks.length > 0 ? await Promise.all(
    otherBlocks.map((block, index) => 
      processOtherBlock(block, aBlockResult.speakerLibrary, language, String.fromCharCode(66 + index))
    )
  ) : [];
  
  // 步骤3: 拼接所有结果
  const allResults = [aBlockResult.script, ...otherBlockResults];
  const finalScript = allResults.join('\n\n');
  
  const processingTime = Date.now() - startTime;
  const estimatedTokens = Math.ceil((transcript.length + finalScript.length) / 2);
  const retentionRate = finalScript.length / transcript.length;
  
  console.log(`ABCDE分块处理完成，耗时: ${processingTime}ms`);
  console.log(`最终脚本长度: ${finalScript.length} 字符`);
  console.log(`保留率: ${(retentionRate * 100).toFixed(1)}%`);
  
  // 检查内容保留率，如果低于90%，记录警告
  if (retentionRate < 0.9) {
    console.warn(`⚠️ 内容保留率过低: ${(retentionRate * 100).toFixed(1)}% < 90%，可能存在过度压缩`);
    console.warn(`原始长度: ${transcript.length} 字符，输出长度: ${finalScript.length} 字符`);
  } else {
    console.log(`✅ 内容保留率正常: ${(retentionRate * 100).toFixed(1)}%`);
  }
  
  return {
    script: finalScript,
    processingTime,
    estimatedTokens,
    chunks: chunks.length,
    speakerLibrary: aBlockResult.speakerLibrary
  };
}

/**
 * 基于ASR片段数组创建ABCDE分块
 * 混合策略：优先按片段数分块，但设置字符数上限保护
 */
function createABCDEChunksFromSegments(segments: string[]): string[] {
  const chunks: string[] = [];
  // 策略：<=20段直接整文清洗；>20段则每20段为一块
  const segmentsPerChunk = 20;
  const maxCharsPerChunk = 50000; // 提高字符数上限，减少分块数量
  
  if (segments.length <= 20) {
    const whole = segments.join('\n\n').trim();
    if (whole) chunks.push(whole);
    console.log(`分块策略: 段数<=20，整文清洗（1块，${whole.length}字符）`);
    return chunks;
  }

  let currentChunk = '';
  let currentChunkSize = 0;
  let segmentsInCurrentChunk = 0;
  
  for (const segment of segments) {
    const segmentLength = segment.length;
    
    // 检查是否需要开始新块：
    // 1. 当前块已包含足够的片段数（20段）
    // 2. 或者当前块加上新片段会超过字符限制
    const shouldStartNewChunk = 
      (segmentsInCurrentChunk >= segmentsPerChunk) ||
      (currentChunkSize + segmentLength > maxCharsPerChunk && currentChunk.trim());
    
    if (shouldStartNewChunk && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = segment;
      currentChunkSize = segmentLength;
      segmentsInCurrentChunk = 1;
    } else {
      if (currentChunk) {
        currentChunk += '\n\n' + segment;
        currentChunkSize += segmentLength + 2; // +2 for \n\n
        segmentsInCurrentChunk++;
      } else {
        currentChunk = segment;
        currentChunkSize = segmentLength;
        segmentsInCurrentChunk = 1;
      }
    }
  }
  
  // 添加最后一个块
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  console.log(`分块策略: 混合策略，每${segmentsPerChunk}个片段一块，最大${maxCharsPerChunk}字符`);
  console.log(`总ASR片段数: ${segments.length}`);
  console.log(`分块数: ${chunks.length}`);
  console.log(`各块长度: ${chunks.map((c, i) => `${String.fromCharCode(65 + i)}(${c.length}字符)`).join(', ')}`);
  
  return chunks;
}

/**
 * 创建ABCDE分块（兼容性函数）
 * 每10个音频片段为一块 (对应10个170秒音频片段)
 * 注意：此函数应该只在ASR片段数组不可用时使用
 */
function createABCDEChunks(transcript: string): string[] {
  // 按音频片段分割 (每个音频片段转写后通常是一个段落)
  const audioSegments = transcript.split('\n\n').filter(p => p.trim());
  
  console.log(`转录文本分割结果: ${audioSegments.length}个段落`);
  
  // 如果只有一个段落（ASR转写质量问题），按字符数分块
  if (audioSegments.length === 1) {
    console.log('⚠️ 检测到单段落转录，按字符数分块（这不是理想情况）');
    const chunkSize = 8000; // 每块8K字符
    const chunks: string[] = [];
    
    for (let i = 0; i < transcript.length; i += chunkSize) {
      const chunk = transcript.slice(i, i + chunkSize);
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }
    
    console.log(`分块策略: 按字符数分块，每块${chunkSize}字符`);
    console.log(`总字符数: ${transcript.length}`);
    console.log(`分块数: ${chunks.length}`);
    
    return chunks;
  }
  
  // 正常情况：每10个音频片段为一块
  const chunks: string[] = [];
  const chunkSize = 10;
  
  for (let i = 0; i < audioSegments.length; i += chunkSize) {
    const chunk = audioSegments.slice(i, i + chunkSize).join('\n\n');
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
  }
  
  console.log(`分块策略: 每${chunkSize}个音频片段为一块`);
  console.log(`总音频片段数: ${audioSegments.length}`);
  console.log(`分块数: ${chunks.length}`);
  
  return chunks;
}

/**
 * 处理A块: 生成角色库 + 清洗内容
 */
async function processABlock(block: string, language: string): Promise<{ script: string; speakerLibrary: string }> {
  console.log('A块处理: 生成角色库 + 清洗内容');
  
  // 步骤1: 清洗A块内容
  const cleanedScript = await cleanBlockContent(block, language, 'A块清洗');
  
  // 步骤2: 生成角色库
  const speakerLibrary = await generateSpeakerLibrary(block, language);
  
  return {
    script: cleanedScript,
    speakerLibrary
  };
}

/**
 * 处理其他块: 基于角色库清洗内容
 */
async function processOtherBlock(block: string, speakerLibrary: string, language: string, blockName: string): Promise<string> {
  console.log(`${blockName}块处理: 基于角色库清洗内容`);
  console.log(`角色库长度: ${speakerLibrary.length}字符`);
  
  const systemPrompt = `清洗播客访谈文本（基于角色库）。

【说话人角色库】
${speakerLibrary}

【任务说明】
这是文字清洗任务，不是摘要、不是润色、不是改写、不是总结。
保留原文的所有有效信息与表达结构，仅删除语气词和无意义的口头填充。

【核心原则】
1. **内容完整性优先**
   - 保留所有观点、案例、故事、数据、解释、分析、逻辑、细节。
   - 不得删除任何完整句子或段落。
   - 不得改变语序、语气或句式。
   - 不得合并或改写相邻句子。
   - 不得"优化表达"或"提高可读性"。
   - 不得删除任何有价值的信息。

2. **严格限制删除范围**
   仅删除以下语气词及口头赘语：
   「嗯」「啊」「呃」「那个」「然后」「就是」「其实」「你知道吧」「我觉得吧」「对吧」「所以说」「我感觉」「这样子」「这个」「那个时候」「怎么说呢」
   —— 除此之外的任何词语、短语、句子，都必须原样保留。

3. **输出字数要求**
   - 输出字数必须为原文字数的 **90%–100%**。
   - 不允许主动缩写或删减任何有意义的内容。
   - 如果输出字数低于90%，说明删除了过多内容，需要重新处理。

4. **角色标注格式**
   - 保持原始对话结构，识别并按角色库标注每位发言者；必须使用角色库中的完整标识，不得擅自修改。

【输出格式】
- **角色标识**：清洗后的内容
- **角色标识**：清洗后的内容`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `请处理${blockName}块内容，严格按照角色库标识：\n\n${block}` }
  ];

  const result = await qwenChat(messages, { 
    maxTokens: 32000,  // 提高输出上限，确保内容完整性
    temperature: 0.1
  });

  return result;
}

/**
 * 清洗块内容
 */
async function cleanBlockContent(block: string, language: string, blockType: string): Promise<string> {
  const systemPrompt = `清洗播客访谈文本。

【任务说明】
这是文字清洗任务，不是摘要、不是润色、不是改写、不是总结。
保留原文的所有有效信息与表达结构，仅删除语气词和无意义的口头填充。

【核心原则】
1. **内容完整性优先**
   - 保留所有观点、案例、故事、数据、解释、分析、逻辑、细节。
   - 不得删除任何完整句子或段落。
   - 不得改变语序、语气或句式。
   - 不得合并或改写相邻句子。
   - 不得"优化表达"或"提高可读性"。
   - 不得删除任何有价值的信息。

2. **严格限制删除范围**
   仅删除以下语气词及口头赘语：
   「嗯」「啊」「呃」「那个」「然后」「就是」「其实」「你知道吧」「我觉得吧」「对吧」「所以说」「我感觉」「这样子」「这个」「那个时候」「怎么说呢」
   —— 除此之外的任何词语、短语、句子，都必须原样保留。

3. **输出字数要求**
   - 输出字数必须为原文字数的 **90%–100%**。
   - 不允许主动缩写或删减任何有意义的内容。
   - 如果输出字数低于90%，说明删除了过多内容，需要重新处理。

4. **角色标注格式**
   - 保持原始对话结构，识别并标注每位发言者；使用格式：- **角色标识**：内容。

【输出格式】
- **主持人**：清洗后的内容
- **嘉宾（姓名）**：清洗后的内容`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `请处理${blockType}内容：\n\n${block}` }
  ];

  const result = await qwenChat(messages, { 
    maxTokens: 32000,  // 提高输出上限，确保内容完整性
    temperature: 0.1
  });

  return result;
}

/**
 * 生成说话人角色库
 */
async function generateSpeakerLibrary(block: string, language: string): Promise<string> {
  console.log('生成说话人角色库，A块长度:', block.length, '字符');
  
  const systemPrompt = `分析播客对话中的参与者。

任务：识别文本中的对话者身份。

规则：
- 主持人：使用"主持人"
- 嘉宾：使用"嘉宾"

要求：
- 标识简洁明确
- 必须包含至少一个角色
- 输出纯文本格式

输出格式：
【说话人角色库】
- 主持人：节目主持人
- 嘉宾：访谈嘉宾

【角色识别规则】
- 主持人标识：使用"主持人"
- 嘉宾标识：使用"嘉宾"`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `请分析以下播客文本中的说话人角色：\n\n${block.substring(0, 1000)}${block.length > 1000 ? '...' : ''}` }
  ];

  const result = await qwenChat(messages, { 
    maxTokens: 3000,
    temperature: 0.1
  });

  console.log('角色库生成完成，长度:', result.length, '字符');
  console.log('角色库内容:', result.substring(0, 300), '...');
  return result;
}
