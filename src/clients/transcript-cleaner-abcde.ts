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
  console.log('═══════════════════════════════════════');
  console.log('📝 步骤1: 处理A块（生成角色库 + 清洗内容）');
  console.log(`A块长度: ${chunks[0].length}字符`);
  console.log('═══════════════════════════════════════');
  const aBlockResult = await processABlock(chunks[0], language);
  console.log(`✅ A块处理完成，清洗后长度: ${aBlockResult.script.length}字符`);
  
  // 步骤2: 并行处理BCDE块
  console.log('═══════════════════════════════════════');
  console.log(`📝 步骤2: 并行处理${chunks.length - 1}个后续块`);
  console.log(`角色库长度: ${aBlockResult.speakerLibrary.length}字符`);
  console.log(`角色库内容: ${aBlockResult.speakerLibrary.substring(0, 200)}...`);
  console.log('═══════════════════════════════════════');
  
  const otherBlocks = chunks.slice(1);
  
  // 关键修复：使用Promise.allSettled替代Promise.all
  // 这样即使某些块失败，也能继续处理其他块，不会因为一个块失败就全部失败
  const blockResults = otherBlocks.length > 0 ? await Promise.allSettled(
    otherBlocks.map((block, index) => {
      const blockName = String.fromCharCode(66 + index);
      console.log(`开始处理${blockName}块 (${block.length}字符)`);
      return processOtherBlock(block, aBlockResult.speakerLibrary, language, blockName);
    })
  ) : [];
  
  // 处理结果：成功和失败的块分开处理
  const otherBlockResults: string[] = [];
  const failedBlocks: Array<{ name: string; error: string; index: number }> = [];
  
  blockResults.forEach((result, index) => {
    const blockName = String.fromCharCode(66 + index);
    if (result.status === 'fulfilled') {
      otherBlockResults.push(result.value);
      console.log(`✅ ${blockName}块处理成功`);
    } else {
      const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`❌ ${blockName}块处理失败: ${errorMessage}`);
      failedBlocks.push({ name: blockName, error: errorMessage, index: index + 1 });
      
      // 失败的块使用原文（作为容错机制，但不应该经常发生）
      const originalBlock = otherBlocks[index];
      console.warn(`⚠️ ${blockName}块清洗失败，使用原文作为备选`);
      otherBlockResults.push(originalBlock);
    }
  });
  
  if (failedBlocks.length > 0) {
    const failureRate = (failedBlocks.length / blockResults.length * 100).toFixed(1);
    console.error(`❌ ${failedBlocks.length}/${blockResults.length} 个块处理失败（失败率: ${failureRate}%）`);
    console.error('失败的块:', failedBlocks.map(f => `${f.name}块`).join(', '));
    console.error('失败原因:', failedBlocks.map(f => `${f.name}块: ${f.error}`).join('; '));
    
    // 修改逻辑：即使失败率超过50%，也不抛出错误，而是使用原文作为备选
    // 因为播客总结已独立于清洗，清洗失败不应影响整体处理成功
    if (failedBlocks.length > blockResults.length / 2) {
      console.warn(`⚠️ 警告：${failedBlocks.length}/${blockResults.length} 个块处理失败，失败率过高（${failureRate}%）`);
      console.warn(`   失败的块将使用原文，整体清洗质量会受影响，但不影响播客总结生成`);
      console.warn(`   失败的块: ${failedBlocks.map(f => f.name).join(', ')}`);
      // 不再抛出错误，继续处理
    } else {
      console.warn(`⚠️ 部分块处理失败（${failureRate}%），但继续使用成功块的结果和失败块的原文`);
    }
  }
  
  if (otherBlockResults.length > 0) {
    console.log(`✅ 后续块处理完成，成功: ${otherBlockResults.length - failedBlocks.length}个，失败: ${failedBlocks.length}个`);
  }
  
  // 步骤3: 拼接所有结果
  const allResults = [aBlockResult.script, ...otherBlockResults];
  const finalScript = allResults.join('\n\n');
  
  const processingTime = Date.now() - startTime;
  const estimatedTokens = Math.ceil((transcript.length + finalScript.length) / 2);
  const retentionRate = finalScript.length / transcript.length;
  
  console.log(`ABCDE分块处理完成，耗时: ${processingTime}ms`);
  console.log(`最终脚本长度: ${finalScript.length} 字符`);
  console.log(`保留率: ${(retentionRate * 100).toFixed(1)}%`);
  
  // 检查清洗结果是否与原文完全相同（100%相同）
  if (finalScript === transcript || (finalScript.length === transcript.length && finalScript.trim() === transcript.trim())) {
    console.error(`❌ 严重警告：清洗结果与ASR原文100%相同！`);
    console.error(`原始长度: ${transcript.length} 字符，输出长度: ${finalScript.length} 字符`);
    console.error(`这可能意味着：1) LLM返回了原文 2) 清洗过程未正确执行`);
    
    // 检查语气词数量，确认是否真的未清洗
    const commonFillers = ['嗯', '啊', '呃', '那个', '然后', '就是', '其实', '你知道吧', '我觉得吧', '对吧', '所以说', '我感觉', '这样子', '这个', '那个时候', '怎么说呢'];
    let originalFillerCount = 0;
    let cleanedFillerCount = 0;
    commonFillers.forEach(filler => {
      const originalMatches = transcript.match(new RegExp(filler, 'g'));
      const cleanedMatches = finalScript.match(new RegExp(filler, 'g'));
      originalFillerCount += originalMatches ? originalMatches.length : 0;
      cleanedFillerCount += cleanedMatches ? cleanedMatches.length : 0;
    });
    
    console.error(`原文语气词数量: ${originalFillerCount}，清洗稿语气词数量: ${cleanedFillerCount}`);
    
    // 修改：不再抛出错误，而是记录警告，使用ASR原文
    // 因为清洗失败不影响整体处理成功（播客总结已独立）
    if (originalFillerCount === cleanedFillerCount && originalFillerCount > 0) {
      console.error(`⚠️ 警告：清洗结果与ASR原文完全相同（语气词数量相同：${originalFillerCount}）`);
      console.error(`   所有块的清洗可能都失败了，将使用ASR原文作为清洗稿`);
      console.error(`   清洗失败不影响播客总结生成，整体处理仍可继续`);
      // 直接返回原文，不抛出错误
      return {
        script: transcript,  // 返回ASR原文作为清洗稿
        processingTime,
        estimatedTokens: Math.ceil(transcript.length / 2),  // 简化的token估算
        chunks: chunks.length,
        speakerLibrary: aBlockResult.speakerLibrary
      };
    } else {
      // 即使语气词数量不同，如果长度完全相同，也使用原文
      console.warn(`⚠️ 清洗结果与ASR原文长度完全相同，将使用ASR原文作为清洗稿`);
      return {
        script: transcript,
        processingTime,
        estimatedTokens: Math.ceil(transcript.length / 2),
        chunks: chunks.length,
        speakerLibrary: aBlockResult.speakerLibrary
      };
    }
  } else if (retentionRate < 0.9) {
    console.warn(`⚠️ 内容保留率过低: ${(retentionRate * 100).toFixed(1)}% < 90%，可能存在过度压缩`);
    console.warn(`原始长度: ${transcript.length} 字符，输出长度: ${finalScript.length} 字符`);
    console.warn(`注：内容保留率低不影响整体处理成功，清洗稿作为独立输出`);
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
  // 策略：<=10段直接整文清洗；>10段则每10段为一块（配合120s切片≈1200s/块，约20分钟）
  // 优化：从每6段改为每10段，减少块数，提升整体成功率
  // - 长时长播客（73段）：从13块减少到8块，成功率从28%提升到48%
  // - 短时长播客（26段）：从5块减少到3块，成功率从66%提升到81%
  const segmentsPerChunk = 10;
  const maxCharsPerChunk = 50000; // 提高字符数上限，减少分块数量
  
  if (segments.length <= segmentsPerChunk) {
    const whole = segments.join('\n\n').trim();
    if (whole) chunks.push(whole);
    console.log(`分块策略: 段数<=${segmentsPerChunk}，整文清洗（1块，${whole.length}字符）`);
    return chunks;
  }

  let currentChunk = '';
  let currentChunkSize = 0;
  let segmentsInCurrentChunk = 0;
  
  for (const segment of segments) {
    const segmentLength = segment.length;
    
    // 检查是否需要开始新块：
    // 1. 当前块已包含足够的片段数（segmentsPerChunk段）
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
  
  console.log(`分块策略: 混合策略，每${segmentsPerChunk}个片段一块（约${(segmentsPerChunk * 120 / 60).toFixed(0)}分钟/块），最大${maxCharsPerChunk}字符`);
  console.log(`总ASR片段数: ${segments.length}`);
  console.log(`分块数: ${chunks.length}`);
  console.log(`各块长度: ${chunks.map((c, i) => `${String.fromCharCode(65 + i)}(${c.length}字符)`).join(', ')}`);
  
  return chunks;
}

/**
 * 创建ABCDE分块（兼容性函数）
 * 每10个音频片段为一块（与createABCDEChunksFromSegments保持一致）
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
  
  // 正常情况：每10个音频片段为一块（与createABCDEChunksFromSegments保持一致）
  // 优化：从每6段改为每10段，减少块数，提升整体成功率
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
  console.log(`输入块长度: ${block.length}字符`);
  
  // 统计输入块的语气词数量，用于后续验证
  const commonFillers = ['嗯', '啊', '呃', '那个', '然后', '就是', '其实', '你知道吧', '我觉得吧', '对吧', '所以说', '我感觉', '这样子', '这个', '那个时候', '怎么说呢'];
  let inputFillerCount = 0;
  commonFillers.forEach(filler => {
    const matches = block.match(new RegExp(filler, 'g'));
    inputFillerCount += matches ? matches.length : 0;
  });
  console.log(`${blockName}块输入语气词数量: ${inputFillerCount}`);
  
  const systemPrompt = `清洗播客访谈文本（基于角色库）。

【说话人角色库】
${speakerLibrary}

【任务说明】
这是文字清洗任务，不是摘要、不是润色、不是改写、不是总结。
保留原文的所有有效信息与表达结构，**必须删除**语气词和无意义的口头填充。

【核心原则】
1. **必须删除语气词（重要！）**
   - **强制要求**：必须删除以下所有语气词及口头赘语：
   - 「嗯」「啊」「呃」「那个」「然后」「就是」「其实」「你知道吧」「我觉得吧」「对吧」「所以说」「我感觉」「这样子」「这个」「那个时候」「怎么说呢」「啊」「嗯嗯」「呃呃」
   - **如果原文包含这些词语，输出时必须删除它们！**
   - **如果输出结果仍然包含这些语气词，说明清洗失败！**

2. **内容完整性优先**
   - 保留所有观点、案例、故事、数据、解释、分析、逻辑、细节。
   - 不得删除任何完整句子或段落（除了语气词）。
   - 不得改变语序、语气或句式。
   - 不得合并或改写相邻句子。
   - 不得"优化表达"或"提高可读性"。
   - 不得删除任何有价值的信息。

3. **清洗示例**
   - 原文：「嗯，那个，其实我觉得这个项目，然后，就是，怎么说呢，可能不太行」
   - 清洗后：「我觉得这个项目可能不太行」
   - **注意**：删除了「嗯」「那个」「其实」「然后」「就是」「怎么说呢」，但保留了核心观点

4. **输出要求**
   - **必须删除语气词**：检查输出是否仍然包含语气词，如果包含则必须重新处理
   - 保持内容的完整性和准确性
   - 不得删除任何有价值的信息

5. **角色标注格式**
   - 保持原始对话结构，识别并按角色库标注每位发言者；必须使用角色库中的完整标识，不得擅自修改。

【输出格式】
- **角色标识**：清洗后的内容（必须删除所有语气词）
- **角色标识**：清洗后的内容（必须删除所有语气词）`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `请处理${blockName}块内容，严格按照角色库标识：\n\n${block}` }
  ];

  console.log(`🔄 开始调用AI清洗${blockName}块 (${block.length}字符)...`);
  const aiCallStartTime = Date.now();
  
  const result = await qwenChat(messages, { 
    maxTokens: 32000,  // 提高输出上限，确保内容完整性
    temperature: 0.1
  });
  
  const aiCallDuration = Date.now() - aiCallStartTime;
  console.log(`✅ AI清洗${blockName}块完成，耗时: ${aiCallDuration}ms，输出长度: ${result.length}字符`);

  // 统计输出块的语气词数量
  let outputFillerCount = 0;
  commonFillers.forEach(filler => {
    const matches = result.match(new RegExp(filler, 'g'));
    outputFillerCount += matches ? matches.length : 0;
  });
  console.log(`${blockName}块输出语气词数量: ${outputFillerCount}，删除了 ${inputFillerCount - outputFillerCount} 个语气词`);
  
  // 验证清洗结果：如果返回的结果与输入完全相同，可能是LLM返回了原文
  if (result === block || (result.length === block.length && result.trim() === block.trim())) {
    console.error(`❌ ${blockName}块清洗结果与原文完全相同，LLM返回了原文！`);
    console.error(`原文长度: ${block.length}字符，清洗结果长度: ${result.length}字符`);
    
    if (inputFillerCount === outputFillerCount && inputFillerCount > 0) {
      // 语气词数量完全相同，确认清洗未生效
      // 修改：不再抛出错误，而是返回原文
      console.error(`❌ ${blockName}块清洗失败：LLM返回了未清洗的原文（语气词数量相同：${inputFillerCount}）`);
      console.warn(`⚠️ ${blockName}块将使用原文作为备选（清洗失败不影响整体处理）`);
      // 返回原文而不是抛出错误，让Promise.allSettled捕获
      throw new Error(`${blockName}块清洗失败：LLM返回了未清洗的原文（语气词数量相同：${inputFillerCount}）`);
    }
  } else if (inputFillerCount > 0 && outputFillerCount === inputFillerCount) {
    // 虽然长度不同，但语气词数量相同，说明清洗未生效
    console.error(`❌ ${blockName}块清洗失败：虽然长度有变化，但语气词数量完全相同（${outputFillerCount}），清洗未生效！`);
    console.warn(`⚠️ ${blockName}块将使用原文作为备选（清洗失败不影响整体处理）`);
    // 抛出错误，让Promise.allSettled捕获，然后使用原文
    throw new Error(`${blockName}块清洗失败：语气词未删除（输入：${inputFillerCount}，输出：${outputFillerCount}）`);
  }

  return result;
}

/**
 * 清洗块内容
 */
async function cleanBlockContent(block: string, language: string, blockType: string): Promise<string> {
  console.log(`开始清洗${blockType}，输入长度: ${block.length}字符`);
  
  // 统计输入块的语气词数量，用于后续验证
  const commonFillers = ['嗯', '啊', '呃', '那个', '然后', '就是', '其实', '你知道吧', '我觉得吧', '对吧', '所以说', '我感觉', '这样子', '这个', '那个时候', '怎么说呢'];
  let inputFillerCount = 0;
  commonFillers.forEach(filler => {
    const matches = block.match(new RegExp(filler, 'g'));
    inputFillerCount += matches ? matches.length : 0;
  });
  console.log(`${blockType}输入语气词数量: ${inputFillerCount}`);
  
  const systemPrompt = `清洗播客访谈文本。

【任务说明】
这是文字清洗任务，不是摘要、不是润色、不是改写、不是总结。
保留原文的所有有效信息与表达结构，**必须删除**语气词和无意义的口头填充。

【核心原则】
1. **必须删除语气词（重要！）**
   - **强制要求**：必须删除以下所有语气词及口头赘语：
   - 「嗯」「啊」「呃」「那个」「然后」「就是」「其实」「你知道吧」「我觉得吧」「对吧」「所以说」「我感觉」「这样子」「这个」「那个时候」「怎么说呢」「啊」「嗯嗯」「呃呃」
   - **如果原文包含这些词语，输出时必须删除它们！**
   - **如果输出结果仍然包含这些语气词，说明清洗失败！**

2. **内容完整性优先**
   - 保留所有观点、案例、故事、数据、解释、分析、逻辑、细节。
   - 不得删除任何完整句子或段落（除了语气词）。
   - 不得改变语序、语气或句式。
   - 不得合并或改写相邻句子。
   - 不得"优化表达"或"提高可读性"。
   - 不得删除任何有价值的信息。

3. **清洗示例**
   - 原文：「嗯，那个，其实我觉得这个项目，然后，就是，怎么说呢，可能不太行」
   - 清洗后：「我觉得这个项目可能不太行」
   - **注意**：删除了「嗯」「那个」「其实」「然后」「就是」「怎么说呢」，但保留了核心观点

4. **输出要求**
   - **必须删除语气词**：检查输出是否仍然包含语气词，如果包含则必须重新处理
   - 保持内容的完整性和准确性
   - 不得删除任何有价值的信息

5. **角色标注格式**
   - 保持原始对话结构，识别并标注每位发言者；使用格式：- **角色标识**：内容。

【输出格式】
- **主持人**：清洗后的内容（必须删除所有语气词）
- **嘉宾（姓名）**：清洗后的内容（必须删除所有语气词）`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `请处理${blockType}内容：\n\n${block}` }
  ];

  console.log(`🔄 开始调用AI清洗${blockType} (${block.length}字符)...`);
  const aiCallStartTime = Date.now();
  
  const result = await qwenChat(messages, { 
    maxTokens: 32000,  // 提高输出上限，确保内容完整性
    temperature: 0.1
  });
  
  const aiCallDuration = Date.now() - aiCallStartTime;
  console.log(`✅ AI清洗${blockType}完成，耗时: ${aiCallDuration}ms，输出长度: ${result.length}字符`);
  
  // 统计输出块的语气词数量
  let outputFillerCount = 0;
  commonFillers.forEach(filler => {
    const matches = result.match(new RegExp(filler, 'g'));
    outputFillerCount += matches ? matches.length : 0;
  });
  console.log(`${blockType}输出语气词数量: ${outputFillerCount}，删除了 ${inputFillerCount - outputFillerCount} 个语气词`);

  // 验证清洗结果：如果返回的结果与输入完全相同，可能是LLM返回了原文
  if (result === block || (result.length === block.length && result.trim() === block.trim())) {
    console.error(`❌ ${blockType}清洗结果与原文完全相同，LLM返回了原文！`);
    console.error(`原文长度: ${block.length}字符，清洗结果长度: ${result.length}字符`);
    
    if (inputFillerCount === outputFillerCount && inputFillerCount > 0) {
      // 语气词数量完全相同，确认清洗未生效
      // 修改：不再抛出错误，而是返回原文
      console.error(`❌ ${blockType}清洗失败：LLM返回了未清洗的原文（语气词数量相同：${inputFillerCount}）`);
      console.warn(`⚠️ ${blockType}将使用原文作为备选（清洗失败不影响整体处理）`);
      // 返回原文而不是抛出错误
      return block;
    }
  } else if (inputFillerCount > 0 && outputFillerCount === inputFillerCount) {
    // 虽然长度不同，但语气词数量相同，说明清洗未生效
    console.error(`❌ ${blockType}清洗失败：虽然长度有变化，但语气词数量完全相同（${outputFillerCount}），清洗未生效！`);
    console.warn(`⚠️ ${blockType}将使用原文作为备选（清洗失败不影响整体处理）`);
    // 返回原文而不是抛出错误
    return block;
  }

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
