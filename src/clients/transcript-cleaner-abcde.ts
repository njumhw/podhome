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
  const otherBlockResults = await Promise.all(
    otherBlocks.map((block, index) => 
      processOtherBlock(block, aBlockResult.speakerLibrary, language, String.fromCharCode(66 + index))
    )
  );
  
  // 步骤3: 拼接所有结果
  const allResults = [aBlockResult.script, ...otherBlockResults];
  const finalScript = allResults.join('\n\n');
  
  const processingTime = Date.now() - startTime;
  const estimatedTokens = Math.ceil((transcript.length + finalScript.length) / 2);
  
  console.log(`ABCDE分块处理完成，耗时: ${processingTime}ms`);
  console.log(`最终脚本长度: ${finalScript.length} 字符`);
  console.log(`压缩比: ${(finalScript.length / transcript.length * 100).toFixed(1)}%`);
  
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
 * 每10个ASR片段为一块
 */
function createABCDEChunksFromSegments(segments: string[]): string[] {
  const chunkSize = 10; // 每10个ASR片段为一块
  const chunks: string[] = [];
  
  for (let i = 0; i < segments.length; i += chunkSize) {
    const chunk = segments.slice(i, i + chunkSize).join('\n\n');
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
  }
  
  console.log(`分块策略: 每${chunkSize}个ASR片段为一块`);
  console.log(`总ASR片段数: ${segments.length}`);
  console.log(`分块数: ${chunks.length}`);
  
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
    const chunkSize = 15000; // 每块15K字符
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
  
  const systemPrompt = `你是播客访谈记录清洗专家。请基于提供的角色库，对当前块进行清洗。

**说话人角色库**:
${speakerLibrary}

**清洗要求**:
1. 删除语气词（如"嗯"、"啊"、"那个"等），保留所有有价值内容
2. **必须保留至少95%的原始内容** - 这是硬性要求
3. 基于访谈实际内容，准确识别出是以上哪个角色在说这段话
4. **严格按照角色库中的标识来标注说话人，不得使用任何变体**
5. 如果遇到角色库中没有的新角色，使用"说话人X"标识
6. **重要：这是访谈记录，必须保留所有访谈对话内容**
7. **禁止过度压缩或删减内容** - 只删除语气词，保留所有观点和案例

**角色识别规则**:
- 必须使用角色库中定义的**完整标识**，不允许自行修改或简化
- 如果角色库中定义的是"主持人（小宇宙）"，就必须使用这个完整标识
- 如果角色库中定义的是"嘉宾（张博士）"，就必须使用这个完整标识
- 不允许使用"主持人"、"嘉宾"等简化标识，除非角色库中明确这样定义
- **角色库是权威的，必须严格按照角色库进行标识**
- 根据角色的说话特征和身份背景来准确识别

**输出格式**:
- **角色标识**：清洗后的内容
- **角色标识**：清洗后的内容

**示例**:
如果角色库定义"主持人（小宇宙）"，则输出：
- **主持人（小宇宙）**：清洗后的内容

**警告**: 如果发现角色库为空或无效，请立即停止处理并报告错误。`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `请处理${blockName}块内容，严格按照角色库标识：\n\n${block}` }
  ];

  const result = await qwenChat(messages, { 
    maxTokens: 8000,  // 增加输出限制，确保内容完整性
    temperature: 0.1
  });

  return result;
}

/**
 * 清洗块内容
 */
async function cleanBlockContent(block: string, language: string, blockType: string): Promise<string> {
  const systemPrompt = `你是播客访谈记录清洗专家。请对${blockType}进行清洗。

**清洗要求**:
1. 删除语气词，保留所有有价值内容
2. **必须保留至少95%的原始内容** - 这是硬性要求
3. 识别并标注说话人角色
4. 使用格式：- **角色标识**：内容
5. **重要：这是访谈记录，必须保留所有访谈对话内容**
6. **禁止过度压缩或删减内容** - 只删除语气词，保留所有观点和案例

**输出格式**:
- **主持人**：清洗后的内容
- **嘉宾（姓名）**：清洗后的内容`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `请处理${blockType}内容：\n\n${block}` }
  ];

  const result = await qwenChat(messages, { 
    maxTokens: 8000,  // 增加输出限制，确保内容完整性
    temperature: 0.1
  });

  return result;
}

/**
 * 生成说话人角色库
 */
async function generateSpeakerLibrary(block: string, language: string): Promise<string> {
  console.log('生成说话人角色库，A块长度:', block.length, '字符');
  
  const systemPrompt = `你是角色识别专家。请分析A块中的所有说话人，生成详细的角色库。

**分析要求**:
1. 仔细识别所有说话人，包括主持人、嘉宾、其他参与者
2. 提取每个角色的具体特征：说话风格、用词习惯、身份背景
3. 确定角色的准确称呼和标识方式
4. 建立严格的角色识别规则
5. **必须基于A块的实际内容进行分析，不要猜测**
6. **如果A块中只有一个说话人，请明确标识为"主持人"或"嘉宾"**

**输出格式**:
【说话人角色库】
- 角色1: 主持人（具体姓名或昵称）- 身份：节目主持人，特征：引导对话、提问、控制节奏
- 角色2: 嘉宾（具体姓名或身份）- 身份：具体专业领域，特征：分享经验、回答问题、表达观点
- 角色3: 其他参与者（如有）- 身份：具体描述，特征：参与讨论、补充信息

【角色识别规则】
- 主持人标识：严格使用"主持人（姓名）"，如无姓名则使用"主持人"
- 嘉宾标识：严格使用"嘉宾（姓名/身份）"，如无姓名则使用"嘉宾"
- 其他角色：根据实际身份确定标识，如"观众"、"其他嘉宾"等
- 保持标识简洁明确，全文统一使用，不得随意更改

【说话特征识别】
- 分析每个角色的说话特点：语速、用词习惯、表达方式
- 记录角色的专业背景和身份特征
- 为后续块的角色识别提供参考依据

【重要提醒】
- 必须严格按照此角色库进行标识，不得使用其他变体
- 不允许使用角色库外的标识或自行创造新标识
- 确保整个播客的说话人标识完全一致
- **角色库必须包含至少一个角色，不能为空**
- **如果A块中只有一个说话人，请明确标识为"主持人"或"嘉宾"**`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `请分析A块中的所有说话人，生成详细角色库：\n\n${block}` }
  ];

  const result = await qwenChat(messages, { 
    maxTokens: 3000,
    temperature: 0.1
  });

  console.log('角色库生成完成，长度:', result.length, '字符');
  console.log('角色库内容:', result.substring(0, 300), '...');
  return result;
}
