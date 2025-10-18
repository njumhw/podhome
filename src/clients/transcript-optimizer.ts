import { qwenChat, ChatMessage } from './qwen-text';
import { getPrompt } from '@/server/prompt-service';

export interface TranscriptOptimizationInput {
  transcript: string;
  title?: string;
  speakers?: string[]; // 可选的说话人列表
}

export interface TranscriptOptimizationOutput {
  optimizedTranscript: string;
  speakerMapping: Record<string, string>; // 原始标识 -> 统一标识的映射
  terminologyMapping: Record<string, string>; // 术语统一映射
  optimizationNotes: string[]; // 优化说明
}

/**
 * 整体优化访谈记录
 * 解决角色标识不一致、专业术语不统一等问题
 */
export async function optimizeTranscript(input: TranscriptOptimizationInput): Promise<TranscriptOptimizationOutput> {
  const { transcript, title, speakers } = input;
  
  console.log(`开始整体优化访谈记录，长度: ${transcript.length} 字符`);
  
  // 获取动态系统提示词
  let systemPrompt: string;
  try {
    systemPrompt = await getPrompt('transcript_optimization');
  } catch (error) {
    console.warn('Failed to get dynamic prompt, using fallback:', error);
    systemPrompt = `你是专业的播客访谈记录优化专家。请对访谈记录进行整体优化，确保角色标识和专业术语的一致性。

**优化目标：**
1. **角色标识统一**：确保同一说话人在整个访谈中使用一致的标识
2. **专业术语统一**：确保同一概念在整个访谈中使用统一的表达
3. **语言风格一致**：保持整体语言风格的连贯性
4. **内容完整性**：不删减任何内容，只进行优化调整

**优化规则：**
- 优先识别主持人/嘉宾的真实姓名，如果无法确定则使用"主持人"/"嘉宾"
- 专业术语保持首次出现时的表达方式，后续统一使用
- 保持原有的对话结构和逻辑关系
- 适当使用项目符号（•）来组织要点，提高可读性

**输出格式：**
请按以下JSON格式输出结果：
{
  "optimizedTranscript": "优化后的完整访谈记录",
  "speakerMapping": {"原始标识": "统一标识"},
  "terminologyMapping": {"原始术语": "统一术语"},
  "optimizationNotes": ["优化说明1", "优化说明2"]
}`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `请优化以下访谈记录：

**播客标题**: ${title || '未提供'}

**访谈记录**:
${transcript}

请按照系统提示的要求进行整体优化，确保角色标识和专业术语的一致性。`
    }
  ];

  try {
    // 质量优先：使用通义千问的最大输出限制
    const response = await qwenChat(messages, { 
      maxTokens: 8000, // 使用最大输出限制，质量优先
      temperature: 0.1 // 降低随机性，确保一致性
    });

    // 尝试解析JSON响应
    let result: TranscriptOptimizationOutput;
    try {
      result = JSON.parse(response);
    } catch (parseError) {
      // 如果JSON解析失败，使用文本响应作为优化后的记录
      console.warn('JSON解析失败，使用文本响应:', parseError);
      result = {
        optimizedTranscript: response,
        speakerMapping: {},
        terminologyMapping: {},
        optimizationNotes: ['使用文本响应作为优化结果']
      };
    }

    console.log(`访谈记录优化完成，优化说明: ${result.optimizationNotes.length} 项`);
    return result;

  } catch (error) {
    console.error('访谈记录优化失败:', error);
    throw new Error(`访谈记录优化失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 检查文本长度是否适合整体优化
 */
export function canOptimizeAsWhole(transcript: string): { canOptimize: boolean; reason?: string } {
  const tokenCount = Math.ceil(transcript.length / 1.5); // 粗略估算
  const maxTokens = 100000; // 保守估计，留出足够空间给输出

  if (tokenCount > maxTokens) {
    return {
      canOptimize: false,
      reason: `文本过长 (${tokenCount.toLocaleString()} tokens)，超过安全限制 (${maxTokens.toLocaleString()} tokens)`
    };
  }

  return { canOptimize: true };
}

/**
 * 分段优化（备用方案）
 * 当文本过长时使用
 */
export async function optimizeTranscriptInChunks(
  transcript: string, 
  title?: string,
  chunkSize: number = 15000
): Promise<TranscriptOptimizationOutput> {
  console.log(`使用分段优化，文本长度: ${transcript.length} 字符`);
  
  // 按段落分割，保持语义完整性
  const paragraphs = transcript.split('\n\n');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  console.log(`分块完成，共 ${chunks.length} 个块`);
  
  // 优化每个块
  const optimizedChunks: string[] = [];
  const allSpeakerMappings: Record<string, string> = {};
  const allTerminologyMappings: Record<string, string> = {};
  const allNotes: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`优化第 ${i + 1}/${chunks.length} 块`);
    
    const chunkResult = await optimizeTranscript({
      transcript: chunks[i],
      title: `${title} (第${i + 1}部分)`
    });
    
    optimizedChunks.push(chunkResult.optimizedTranscript);
    
    // 合并映射和说明
    Object.assign(allSpeakerMappings, chunkResult.speakerMapping);
    Object.assign(allTerminologyMappings, chunkResult.terminologyMapping);
    allNotes.push(...chunkResult.optimizationNotes.map(note => `第${i + 1}部分: ${note}`));
  }
  
  return {
    optimizedTranscript: optimizedChunks.join('\n\n'),
    speakerMapping: allSpeakerMappings,
    terminologyMapping: allTerminologyMappings,
    optimizationNotes: allNotes
  };
}
