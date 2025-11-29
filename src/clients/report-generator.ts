import { qwenChat, ChatMessage } from './qwen-text';
import { getPrompt } from '@/server/prompt-service';

export interface ReportGenerationInput {
  transcript: string; // 清洗后的访谈全文（A2/A3）或ASR原文
  originalTranscript?: string; // ASR原文（A1）
  segments?: string[]; // ASR分段数组（按时间分割的73段），优先使用此字段进行分块
  title?: string;
}

export interface ReportGenerationOutput {
  summary: string;
  outline?: string; // 报告大纲/框架（两轮生成的第一轮产出）
  processingTime: number;
  estimatedTokens: number;
}

/**
 * 两轮生成访谈报告（方案2：框架+填充）
 * 第一轮：生成详细大纲/框架
 * 第二轮：基于框架+原始ASR生成完整报告
 */
export async function generateReportWhole(input: ReportGenerationInput): Promise<ReportGenerationOutput> {
  const { transcript, originalTranscript, title, segments } = input;
  const startTime = Date.now();
  
  // 检查输入长度限制（Qwen Flash支持最大约1M tokens，中文约1:1）
  // 设置安全边界为900K tokens，留100K余量用于提示词和输出
  const transcriptLength = transcript.length;
  const estimatedTokens = transcriptLength; // 中文约1字符=1token
  const promptTokens = 10000; // 估算提示词长度（包括系统提示词和用户提示词）
  const totalInputTokens = estimatedTokens + promptTokens;
  const maxInputTokens = 900000; // 安全边界（1M限制，留100K余量）
  
  // 如果输入超过限制，直接使用分块处理
  if (totalInputTokens > maxInputTokens) {
    console.warn(`⚠️ 输入长度超限 (${totalInputTokens.toLocaleString()} tokens > ${maxInputTokens.toLocaleString()} tokens)，自动切换到分块处理模式`);
    console.log(`   ASR原文: ${transcriptLength.toLocaleString()} 字符`);
    console.log(`   估算总输入: ${totalInputTokens.toLocaleString()} tokens`);
    console.log(`   注意：Qwen Flash支持最大1M tokens，但为了安全留有余量，超过900K时使用分块处理`);
    return await generateReportChunked(input);
  }
  
  // 判断是否使用两轮生成（大纲+填充）
  // 只有当音频段落数超过40个时，才使用两轮生成；否则直接用ASR原文生成总结
  const segmentCount = segments?.length || 0;
  const shouldUseTwoStage = segmentCount > 40;
  
  if (!shouldUseTwoStage) {
    console.log(`音频段落数: ${segmentCount}，小于等于40，使用单轮生成（直接基于ASR原文生成总结）`);
    // 获取系统提示词
    let fallbackSystemPrompt: string;
    try {
      fallbackSystemPrompt = await getPrompt('report_generation_whole');
    } catch (error) {
      console.warn('Failed to get dynamic prompt, using fallback:', error);
      fallbackSystemPrompt = `你是前麦肯锡全球合伙人，前哈佛大学心理系教授，现阿里巴巴战略部负责人。你是一位拥有丰富战略咨询、学术研究和商业实践经验的专家。

请基于ASR原文生成一份专业的播客总结/报告，采用麦肯锡研究报告或投资公司研报的风格。报告应该适合深度阅读，使用完整的长句子进行深入阐述，避免散点式的短句罗列。

**重要：多语言支持**
- 无论ASR原文是中文还是英文，都必须生成高质量的中文总结报告
- 如果ASR原文是英文，请先准确理解英文内容的含义，包括专业术语、文化背景、具体案例和数据
- 确保英文专业术语的准确翻译和理解，保持原意的完整性和准确性
- 输出必须是流畅、专业的中文报告，符合中文读者的阅读习惯`;
    }
    return await generateReportWholeFallback(input, fallbackSystemPrompt);
  }
  
  console.log(`开始两轮生成访谈报告，文本长度: ${transcript.length} 字符，段落数: ${segmentCount}`);
  
  // 获取动态系统提示词
  let systemPrompt: string;
  try {
    systemPrompt = await getPrompt('report_generation_whole');
  } catch (error) {
    console.warn('Failed to get dynamic prompt, using fallback:', error);
    systemPrompt = `你是前麦肯锡全球合伙人，前哈佛大学心理系教授，现阿里巴巴战略部负责人。你是一位拥有丰富战略咨询、学术研究和商业实践经验的专家。

请基于ASR原文生成一份专业的播客总结/报告，采用麦肯锡研究报告或投资公司研报的风格。报告应该适合深度阅读，使用完整的长句子进行深入阐述，避免散点式的短句罗列。

**重要：多语言支持**
- 无论ASR原文是中文还是英文，都必须生成高质量的中文总结报告
- 如果ASR原文是英文，请先准确理解英文内容的含义，包括专业术语、文化背景、具体案例和数据
- 确保英文专业术语的准确翻译和理解，保持原意的完整性和准确性
- 输出必须是流畅、专业的中文报告，符合中文读者的阅读习惯

**重要限制：**
- 仅基于本次提供的播客内容撰写，禁止引入外部信息
- 冲突处理：以 ASR 原文为准，保持原意
- 信息优先：在可用token范围内尽可能详尽，覆盖所有关键观点、数据、案例与逻辑

**输出长度与全面性要求（重要！）：**
- **最大化输出长度**：请充分利用模型的32,000 token输出上限，生成尽可能长的报告
- **目标输出长度**：总结长度应至少达到ASR原文长度的25%（越详细越好），如果ASR原文为100,000字符，目标输出应至少25,000字符或更多
- **全面覆盖**：必须覆盖播客中提到的所有主要观点、次要观点、相关论据、具体案例、数据、引用和细节
- **不要过度压缩**：不要为了简洁而删除重要信息，宁愿报告更长也要保证完整性
- **深度展开**：对每个观点都要提供完整的逻辑链条、论证过程、支撑论据和具体案例
- **无字数限制思维**：在32K token限制内，尽可能生成最详尽、最全面的报告

**写作风格要求（关键！）：**
1. **长句子优先**：使用完整、复杂的长句子进行深入阐述，每个段落应该包含多个相互关联的句子，形成完整的论述链条
2. **避免散点式**：不要使用大量短句或项目符号罗列观点，而是将多个相关观点整合成连贯的段落
3. **逻辑连贯**：每个段落内部和段落之间都要有清晰的逻辑连接，使用过渡词和连接词（如"因此"、"然而"、"进一步而言"、"具体而言"、"值得注意的是"等）
4. **深度阐述**：对每个重要观点，不仅要提出，还要深入解释其背景、原因、影响和意义
5. **专业术语**：使用专业、正式的语言，避免口语化表达
6. **第三人称客观**：以客观、专业的第三人称视角呈现观点，不标注说话人身份
7. **论证完整**：每个观点都要包含完整的论证结构：论点-论据-案例-结论

**报告结构（保持现有结构）：**
- **引言**：概述播客主题、背景与主要议题，使用1-2个完整段落进行深入介绍
- **核心观点**：按主题组织主要观点和论据，每个主题使用多个连贯的长段落进行深入阐述
  - 每个观点都要包含：完整论述、支撑论据、具体案例、数据或引用
  - **重要原话摘录**：每个主要观点应包含1-2条最能体现该观点的原话摘录，使用Markdown引用格式（> 原话内容）突出显示，增加报告的真实性和说服力
  - 使用长句子将相关观点、论据、案例整合成连贯的段落
  - 避免简单的要点罗列，而是将多个要点整合成逻辑连贯的论述
- **次要观点与细节**：补充次要观点、相关讨论、具体细节等，同样使用长段落进行阐述
- **总结与启示**：提炼核心洞见和讨论价值，使用1-2个完整段落进行总结

**格式要求：**
- **优先使用段落**：每个部分主要由多个连贯的段落组成，而不是项目符号列表
- **谨慎使用项目符号**：仅在必要时使用项目符号（如列举多个独立的数据点、技术指标等），但即使是列表项，也要尽量使用完整的句子
- **使用Markdown格式**：使用标题、段落、粗体等Markdown格式组织内容
- **段落长度**：每个段落应该包含3-5个完整的长句子，形成完整的论述单元

**输出要求：**
- 删除口头语、冗余句、重复信息
- 使用正式、清晰、逻辑性强的书面语
- 保持逻辑清晰，突出核心观点
- 避免口语化表达
- **最大化信息价值**：优先保留所有重要的观点、论据、案例和数据
- **绝对禁止添加内容**：不得添加任何播客中未提及的信息、观点或解释
- **忠实原文原则**：所有内容必须严格基于本次提供的内容，不得有任何新增
- **长度目标**：充分利用32K token限制，生成尽可能详尽、全面的报告

**写作示例（参考风格）：**
- ❌ 避免：使用大量短句和项目符号
  - 观点A
  - 观点B
  - 观点C
  
- ✅ 推荐：使用长句子和连贯段落
  "在深入分析这一现象时，我们首先需要理解其背后的根本原因。通过对比多个案例，我们可以发现，这一趋势并非偶然出现，而是多种因素共同作用的结果。具体而言，技术发展的推动、市场需求的演变以及监管环境的变化，共同构成了这一现象产生的背景。值得注意的是，这些因素之间并非简单的线性关系，而是相互影响、相互强化的复杂系统。因此，要全面理解这一现象，我们需要采用系统性的分析方法，从多个维度进行深入探讨。"

**重要提醒：**
- 不要因为追求简洁而牺牲信息的完整性和全面性
- 宁愿报告更长，也要保证覆盖所有重要观点和论据
- 在32K token限制内，尽可能生成最详尽、最全面的报告
- 目标是让读者通过报告就能全面了解播客的核心内容，而不需要去听原音频
- **风格目标**：生成一份像麦肯锡研究报告或投资公司研报那样，适合深度阅读、逻辑严密、论述完整的专业报告`;
  }

  const primarySource = transcript;  // ASR原文（唯一源）
  
  // ========== 第一轮：生成详细大纲/框架 ==========
  console.log('═══════════════════════════════════════════════════════════');
  console.log('第一轮：生成详细大纲/框架');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`准备生成大纲，ASR原文长度: ${primarySource.length} 字符`);
  
  const outlineStartTime = Date.now();
  let outline: string = '';
  
  try {
    console.log('开始调用qwenChat生成大纲...');
    const outlineMessages: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `请基于ASR原文生成一份极其详细的播客报告大纲/框架（不得引入外部信息）：

**播客标题**: ${title || '未提供'}

**ASR原文（唯一源，基于此生成大纲）**:
${primarySource}

**大纲生成要求（极其重要！）：**

1. **全面识别所有主题和观点（必须完整）**
   - 仔细阅读ASR原文的**每一个字**，确保不遗漏任何内容
   - 识别**所有**主要主题、次要主题、子主题
   - 提取**每个**主题下的**所有**关键观点、论据、案例、数据、引用、人名、公司名、数字
   - **绝对禁止**遗漏任何重要信息，即使是次要观点也要包含

2. **构建极其详细的框架**
   - 为**每个**主要主题创建一个章节（不要合并主题）
   - 每个章节必须包含：
     * 主题名称（清晰明确）
     * **所有**关键观点（不要只列出最重要的，要列出所有）
     * **所有**重要论据要点（支撑每个观点的论据）
     * **所有**相关案例（具体案例、故事、例子）
     * **所有**数据、数字、统计信息
     * **所有**人名、公司名、组织名、地名
     * **所有**引用、名言、重要表述
   - 明确各主题之间的逻辑关系和时间顺序
   - 标注每个观点的重要性（核心/重要/次要），但**不要因为标注为次要就省略**

3. **输出格式要求**
   - 使用Markdown格式
   - 使用标题层级（#、##、###）组织结构
   - **每个主题下必须列出所有关键观点和要点**（不要只列出标题）
   - 使用列表或段落详细展开每个观点
   - 保持逻辑清晰，便于后续扩展

4. **详细程度要求（关键！）**
   - 大纲应该**极其详细**，就像是一份"详细目录"
   - 不仅要列出主题，还要列出每个主题下的**所有**子观点
   - 不仅要列出观点，还要列出支撑观点的**关键论据**
   - 不仅要列出论据，还要列出**具体案例和数据**
   - 目标：让读者只看大纲就能了解播客的**全部**核心内容

**重要要求（必须严格遵守）：**
- ✅ **必须覆盖ASR原文中的所有主题和观点**（包括主要和次要）
- ✅ **大纲应该极其详细**，包含每个主题下的**所有**关键观点、论据、案例、数据
- ✅ **目标长度：8,000-12,000字符**（确保覆盖所有内容，不要压缩）
- ✅ **不要过度压缩**，要确保**所有重要信息**都在大纲中
- ✅ **不要省略次要观点**，即使是次要观点也要包含
- ✅ **不要省略数据**，所有数字、统计信息都要包含
- ✅ **不要省略案例**，所有具体案例、故事都要包含
- ✅ **不要省略人名、公司名**，所有提到的实体都要包含

**示例格式（参考）：**
\`\`\`
# 主题一：XXX

## 核心观点A
- 观点A的详细描述
- 支撑论据1：具体说明
- 支撑论据2：具体说明
- 案例1：具体案例描述
- 数据：具体数字和统计

## 核心观点B
- 观点B的详细描述
- 支撑论据...
- 案例...

## 次要观点C（虽然次要，但也要包含）
- 观点C的描述
- 相关论据...

# 主题二：YYY
...
\`\`\`

**最后提醒：**
- 这份大纲将用于生成最终报告，如果大纲遗漏了内容，最终报告也会遗漏
- **宁可大纲更长，也不要遗漏任何重要信息**
- **目标是让大纲成为一份"详细目录"，而不是"简单目录"**

请生成一份极其详细、完整、结构清晰的报告大纲。`
      }
    ];
    
    outline = await qwenChat(outlineMessages, { 
      maxTokens: 12000, // 大纲使用12K token，确保极其详细（从8K提升到12K）
      temperature: 0.1
    });
    
    console.log(`qwenChat返回结果，长度: ${outline?.length || 0} 字符`);
    console.log(`大纲内容预览（前200字符）: ${outline?.substring(0, 200) || '空'}...`);
    
    if (!outline || outline.trim().length === 0) {
      console.error('❌ 大纲生成失败：AI返回了空结果');
      console.error('outline值:', outline);
      throw new Error('大纲生成失败：AI返回了空结果');
    }
    
    const outlineDuration = Date.now() - outlineStartTime;
    console.log(`✅ 大纲生成成功，耗时: ${(outlineDuration / 1000).toFixed(1)}秒`);
    console.log(`大纲长度: ${outline.length} 字符`);
    console.log(`大纲内容前500字符: ${outline.substring(0, 500)}...`);
    
  } catch (outlineError) {
    const errorMessage = outlineError instanceof Error ? outlineError.message : String(outlineError);
    const errorStack = outlineError instanceof Error ? outlineError.stack : undefined;
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ 大纲生成失败，错误详情:');
    console.error('错误消息:', errorMessage);
    if (errorStack) {
      console.error('错误堆栈:', errorStack.substring(0, 500));
    }
    console.error('═══════════════════════════════════════════════════════════');
    // 如果大纲生成失败，回退到单轮生成
    console.log('⚠️ 大纲生成失败，回退到单轮生成模式（不会生成大纲）...');
    return await generateReportWholeFallback(input, systemPrompt);
  }
  
  // ========== 第二轮：基于大纲+原始ASR生成完整报告 ==========
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('第二轮：基于大纲+原始ASR生成完整报告');
  console.log('═══════════════════════════════════════════════════════════');
  
  const reportStartTime = Date.now();
  
  try {
    const reportMessages: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `请基于以下报告大纲和ASR原文，生成一份完整、详尽的播客总结/报告（不得引入外部信息）：

**播客标题**: ${title || '未提供'}

**报告大纲/框架（这是你生成报告的蓝图，必须完全遵循此结构）**:
${outline}

**ASR原文（完整内容，用于填充大纲中的每个部分）**:
${primarySource}

**报告结构要求（必须严格遵守）：**

1. **报告开头必须包含整体内容总结（提纲挈领）**
   - 在报告的最前面，必须添加一个"**报告概述**"或"**内容提要**"部分
   - 用2-3个完整段落，高度概括整个播客的核心主题、主要观点、关键发现和整体价值
   - 这个概述应该让读者在阅读详细内容之前，就能全面了解播客的整体框架和核心内容
   - 概述应该涵盖所有主要主题，但以高度概括的方式呈现

2. **严格遵循大纲结构（最高优先级）**
   - **必须**按照大纲中的所有主题和章节组织报告，保持大纲的结构和顺序
   - **必须**确保大纲中列出的**每个**主题、**每个**观点都在报告中得到详细展开
   - **绝对禁止**遗漏大纲中的任何内容，即使是标注为"次要"的观点也要包含
   - 如果大纲中有10个主题，报告中必须有10个主题；如果大纲中有50个观点，报告中必须有50个观点

3. **充分展开每个部分（基于大纲+ASR原文，提供详细论据、案例和数据）**
   - 对于大纲中的**每个**观点，**必须**在ASR原文中找到对应的详细内容
   - 将大纲中的每个观点扩展成详细的论述，**必须包含**：
     * **完整论述**：基于ASR原文的详细描述，不要只写观点标题
     * **详细论据**：从ASR原文中找到支撑每个观点的所有论据，详细展开每个论据的逻辑链条
     * **具体案例**：从ASR原文中找到所有相关案例、故事、例子，提供完整的案例描述（包括背景、过程、结果）
     * **准确数据**：从ASR原文中找到所有数据、数字、统计信息、研究结果，确保数值准确
     * **完整信息**：从ASR原文中找到所有人名、公司名、组织名、地名、时间、引用等完整信息
     * **重要原话摘录**：从ASR原文中摘录1-2条最能体现该观点的原话，使用Markdown引用格式（> 原话内容）突出显示，增加报告的真实性和说服力
   - **重要**：不要只列出观点，要深入展开。对于每个观点，至少提供2-3个详细论据或案例，以及1-2条重要原话摘录
   - 使用长句子和连贯段落，避免散点式罗列
   - **不要**只列出观点标题，要详细展开每个观点

4. **确保全面覆盖（双重检查）**
   - 首先确保大纲中的所有内容都被包含（这是第一优先级）
   - 然后检查ASR原文，如果发现重要内容未在大纲中，也要补充到报告中
   - 确保报告完整覆盖播客的所有核心内容

**工作流程建议：**
1. 先仔细阅读大纲和ASR原文，理解整体结构和所有主题
2. 撰写报告概述（2-3个段落，概括整体内容）
3. 按照大纲的顺序，逐个主题处理
4. 对于每个主题，找到大纲中列出的所有观点
5. 对于每个观点，在ASR原文中找到对应的详细内容，包括论据、案例、数据
6. 将大纲中的观点和ASR原文中的详细内容结合，生成详细论述
7. 最后检查，确保大纲中的所有内容都被包含，且每个观点都有充分的论据、案例和数据支撑

**输出长度要求（极其重要！）：**
- **必须充分利用32,000 token输出上限**，生成尽可能长、尽可能详尽的报告
- **目标输出长度应至少达到ASR原文长度的25%**（如果ASR原文为109,000字符，目标应为27,250字符或更多）
- **不要因为担心过长而压缩内容**，在32K token限制内，尽可能生成最详尽的报告
- **如果报告长度远低于目标（如低于ASR原文的20%），说明内容展开不充分，需要重新生成**

**内容质量要求：**
- **必须覆盖大纲中的所有主题和观点**（这是硬性要求，不能遗漏）
- **对每个观点都要提供完整的逻辑链条、论证过程、支撑论据和具体案例**
- **每个主要观点至少要有2-3个详细论据或案例支撑，以及1-2条重要原话摘录**
- **重要原话摘录要求**：
  * 从ASR原文中摘录最能体现观点核心的原话（可以是完整句子或关键片段）
  * 使用Markdown引用格式（> 原话内容）突出显示
  * 原话应该具有代表性、说服力，能够增强报告的真实性
  * 原话摘录应该自然地融入论述中，不要孤立存在
- **所有论据、案例、数据、原话都必须来自ASR原文，不得编造或推测**
- 使用长句子和连贯段落，保持逻辑连贯，形成完整的论述链条
- 不要过度压缩，宁愿报告更长也要保证完整性和全面性
- **大纲是你的蓝图，ASR原文是你的素材库，两者结合生成最终报告**

**特别提醒：**
- 大纲已经识别了所有重要内容，你的任务是按照大纲的结构，用ASR原文的详细内容填充每个部分
- 如果大纲中列出了某个观点，但你在ASR原文中找不到对应内容，说明大纲可能有误，此时应该基于ASR原文生成该观点
- 如果ASR原文中有重要内容未在大纲中，说明大纲可能遗漏，此时应该补充到报告中
- **记住：充分利用32K token限制，生成尽可能详尽的报告，不要担心报告太长**

请生成一份完整、连贯、专业、详尽且全面的报告。`
      }
    ];
    
    const summary = await qwenChat(reportMessages, { 
      maxTokens: 32000, // 使用最大输出限制
      temperature: 0.1
    });
    
    if (!summary || summary.trim().length === 0) {
      throw new Error('报告生成失败：AI返回了空结果');
    }
    
    const reportDuration = Date.now() - reportStartTime;
    const totalProcessingTime = Date.now() - startTime;
    const estimatedTokens = Math.ceil((transcript.length + outline.length + summary.length) / 2);
    
    console.log(`✅ 完整报告生成成功，耗时: ${(reportDuration / 1000).toFixed(1)}秒`);
    console.log(`报告长度: ${summary.length} 字符`);
    console.log(`总处理时间: ${(totalProcessingTime / 1000).toFixed(1)}秒`);
    console.log(`压缩比: ${((summary.length / transcript.length) * 100).toFixed(1)}%`);
    
    return {
      summary,
      outline, // 返回大纲作为独立产出
      processingTime: totalProcessingTime,
      estimatedTokens
    };
    
  } catch (reportError) {
    const errorMessage = reportError instanceof Error ? reportError.message : String(reportError);
    const reportDuration = Date.now() - reportStartTime;
    
    console.error('❌ 报告生成失败:', errorMessage);
    console.error('   耗时:', `${(reportDuration / 1000).toFixed(1)}秒`);
    console.error('   输入长度:', transcript.length, '字符');
    console.error('   大纲状态:', outline ? `已生成(${outline.length}字符)` : '未生成');
    
    // 如果报告生成失败，但大纲已生成，可以返回大纲
    if (outline && outline.trim().length > 0) {
      console.warn('⚠️ 报告生成失败，但大纲已生成，返回大纲作为部分结果');
      return {
        summary: '', // 报告为空
        outline, // 返回大纲
        processingTime: Date.now() - startTime,
        estimatedTokens: Math.ceil((transcript.length + outline.length) / 2)
      };
    }
    
    // 如果大纲和报告都失败，回退到单轮生成
    console.log('回退到单轮生成模式...');
    return await generateReportWholeFallback(input, systemPrompt);
  }
}

/**
 * 单轮生成（回退方案）
 * 当两轮生成失败时使用
 * 如果遇到内容审核错误，会自动切换到分块处理模式
 */
async function generateReportWholeFallback(
  input: ReportGenerationInput,
  systemPrompt: string
): Promise<ReportGenerationOutput> {
  const { transcript, title } = input;
  const startTime = Date.now();
  
  console.log('使用单轮生成模式（回退方案）');
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `请基于ASR原文生成最详尽的播客总结/报告（不得引入外部信息）：

**播客标题**: ${title || '未提供'}

**ASR原文（唯一源，基于此生成总结）**:
${transcript}

**报告结构要求（必须严格遵守）：**

1. **报告开头必须包含整体内容总结（提纲挈领）**
   - 在报告的最前面，必须添加一个"**报告概述**"或"**内容提要**"部分
   - 用2-3个完整段落，高度概括整个播客的核心主题、主要观点、关键发现和整体价值
   - 这个概述应该让读者在阅读详细内容之前，就能全面了解播客的整体框架和核心内容
   - 概述应该涵盖所有主要主题，但以高度概括的方式呈现

2. **充分展开每个部分（基于ASR原文，提供详细论据、案例和数据）**
   - 对于ASR原文中的**每个**主要观点，**必须**提供详细的展开，包括：
     * **完整论述**：基于ASR原文的详细描述，不要只写观点标题
     * **详细论据**：从ASR原文中找到支撑每个观点的所有论据，详细展开每个论据的逻辑链条
     * **具体案例**：从ASR原文中找到所有相关案例、故事、例子，提供完整的案例描述（包括背景、过程、结果）
     * **准确数据**：从ASR原文中找到所有数据、数字、统计信息、研究结果，确保数值准确
     * **完整信息**：从ASR原文中找到所有人名、公司名、组织名、地名、时间、引用等完整信息
     * **重要原话摘录**：从ASR原文中摘录1-2条最能体现该观点的原话，使用Markdown引用格式（> 原话内容）突出显示，增加报告的真实性和说服力
   - **重要**：不要只列出观点，要深入展开。对于每个主要观点，至少提供2-3个详细论据或案例，以及1-2条重要原话摘录
   - 使用长句子和连贯段落，避免散点式罗列

**输出长度要求（极其重要！）：**
- **必须充分利用32,000 token输出上限**，生成尽可能长、尽可能详尽的报告
- **目标输出长度应至少达到ASR原文长度的25%**（如果ASR原文为100,000字符，目标应为25,000字符或更多）
- **不要因为担心过长而压缩内容**，在32K token限制内，尽可能生成最详尽的报告
- **如果报告长度远低于目标（如低于ASR原文的20%），说明内容展开不充分，需要重新生成**

**内容质量要求：**
- **必须覆盖所有主要观点、次要观点、相关论据、具体案例、数据、引用和细节**
- **对每个主要观点都要提供完整的逻辑链条、论证过程、支撑论据和具体案例**
- **每个主要观点至少要有2-3个详细论据或案例支撑，以及1-2条重要原话摘录**
- **重要原话摘录要求**：
  * 从ASR原文中摘录最能体现观点核心的原话（可以是完整句子或关键片段）
  * 使用Markdown引用格式（> 原话内容）突出显示
  * 原话应该具有代表性、说服力，能够增强报告的真实性
  * 原话摘录应该自然地融入论述中，不要孤立存在
- **所有论据、案例、数据、原话都必须来自ASR原文，不得编造或推测**
- 使用长句子和连贯段落，保持逻辑连贯，形成完整的论述链条
- 不要过度压缩，宁愿报告更长也要保证完整性和全面性

**特别提醒：**
- **记住：充分利用32K token限制，生成尽可能详尽的报告，不要担心报告太长**
- 目标是让读者通过报告就能全面了解播客的核心内容，而不需要去听原音频

请生成一份完整、连贯、专业、详尽且全面的报告。`
    }
  ];
  
  try {
    const summary = await qwenChat(messages, { 
      maxTokens: 32000,
      temperature: 0.1
    });
    
    if (!summary || summary.trim().length === 0) {
      throw new Error('播客总结生成失败：AI返回了空结果');
    }
    
    return {
      summary,
      processingTime: Date.now() - startTime,
      estimatedTokens: Math.ceil((transcript.length + summary.length) / 2)
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 单轮生成失败:', errorMessage);
    console.error('   输入长度:', transcript.length, '字符');
    console.error('   错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    
    // 如果遇到内容审核错误（或其他可能的API限制错误），切换到分块处理模式
    // 注意：API可能返回误导性的错误信息，所以我们也检查其他可能的错误
    if (/内容审核|inappropriate content|输入|input|limit|限制/i.test(errorMessage)) {
      console.warn('⚠️ 检测到可能的API限制错误，切换到分块处理模式...');
      console.log('   分块处理可以避免一次性发送大量内容，降低API限制触发概率');
      return await generateReportChunked(input);
    }
    // 其他错误直接抛出
    throw error;
  }
}

/**
 * 分块报告生成（备用方案）
 * 当整体生成失败时，使用此方法分块处理
 */
async function generateReportChunked(input: ReportGenerationInput): Promise<ReportGenerationOutput> {
  const { transcript, originalTranscript, title, segments } = input;
  const startTime = Date.now();
  
  console.log(`开始分块生成报告，文本长度: ${transcript.length} 字符`);
  
  // 优先使用ASR分段（按时间分割的73段），保持语义边界
  let chunks: string[] = [];
  
  if (segments && segments.length > 0) {
    // 使用ASR原有的分段（73段，每段120秒）
    console.log(`✅ 使用ASR原有分段: ${segments.length} 段（保持语义边界）`);
    chunks = segments.filter(seg => seg && seg.trim());
    
    // 如果ASR段数过多（>100），可以合并相邻段以减少API调用
    // 但保持段的完整性，不破坏语义边界
    if (chunks.length > 100) {
      console.log(`ASR段数较多（${chunks.length}段），合并相邻段以减少API调用...`);
      const mergedChunks: string[] = [];
      const mergeRatio = Math.ceil(chunks.length / 100); // 目标100段左右
      
      for (let i = 0; i < chunks.length; i += mergeRatio) {
        const merged = chunks.slice(i, i + mergeRatio).join('\n\n');
        if (merged.trim()) {
          mergedChunks.push(merged.trim());
        }
      }
      chunks = mergedChunks;
      console.log(`合并后: ${chunks.length} 个块`);
    }
  } else {
    // 降级策略：如果没有segments，按固定字符数切割（原有逻辑）
    console.log(`⚠️ 未提供ASR分段，使用固定字符数切割（可能破坏语义边界）`);
    const chunkSize = 4000; // 字符
    const overlap = 500; // 字符重叠
    
    for (let i = 0; i < transcript.length; i += chunkSize - overlap) {
      const end = Math.min(i + chunkSize, transcript.length);
      const chunk = transcript.slice(i, end);
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }
  }
  
  console.log(`文本分成 ${chunks.length} 个块进行处理`);
  
  // 获取系统提示词
  let systemPrompt: string;
  try {
    systemPrompt = await getPrompt('report_generation_whole');
  } catch (error) {
    systemPrompt = `你是专业的播客访谈报告撰写专家。请基于播客内容片段生成报告摘要。
要求：保留核心观点、逻辑清晰、客观表达、使用Markdown格式。`;
  }
  
  // 分别处理每个块
  const reportChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const chunkResult = await qwenChat([
        { role: "system", content: systemPrompt },
        { role: "user", content: `请基于以下播客内容片段生成报告摘要：\n\n${chunks[i]}` }
      ], { maxTokens: 2500, temperature: 0.1 });
      
      if (chunkResult && chunkResult.trim()) {
        reportChunks.push(chunkResult.trim());
        console.log(`块 ${i + 1}/${chunks.length} 处理成功`);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 如果某个块也遇到内容审核错误，记录但继续处理其他块
      if (/内容审核|inappropriate content/i.test(errorMessage)) {
        console.warn(`块 ${i + 1}/${chunks.length} 遇到内容审核错误，跳过该块`);
      } else {
        console.warn(`块 ${i + 1}/${chunks.length} 处理失败，跳过:`, errorMessage);
      }
    }
  }
  
  // 如果所有块都失败了，抛出错误
  if (reportChunks.length === 0) {
    throw new Error('所有分块处理均失败，无法生成报告');
  }
  
  // 合并所有块的结果
  const combinedReport = reportChunks.join('\n\n');
  
  // 生成最终整合报告
  let finalSummary = combinedReport;
  if (reportChunks.length > 1) {
    try {
      const finalPrompt = `请将以下多个报告片段整合成一份完整、连贯的播客总结报告：
      
${combinedReport}

要求：保持逻辑连贯、删除重复内容、使用Markdown格式。`;
      
      finalSummary = await qwenChat([
        { role: "system", content: systemPrompt },
        { role: "user", content: finalPrompt }
      ], { maxTokens: 32000, temperature: 0.1 });
    } catch (error) {
      console.warn('最终整合失败，使用合并结果:', error);
      finalSummary = combinedReport;
    }
  }
  
  const processingTime = Date.now() - startTime;
  const estimatedTokens = Math.ceil((transcript.length + finalSummary.length) / 2);
  
  console.log(`分块报告生成完成，耗时: ${processingTime}ms，Token估算: ${estimatedTokens}`);
  
  return {
    summary: finalSummary,
    processingTime,
    estimatedTokens
  };
}

/**
 * 检查文本长度是否适合整体处理
 */
export function canProcessAsWhole(transcript: string): { canProcess: boolean; reason?: string } {
  const tokenCount = Math.ceil(transcript.length / 1.5); // 粗略估算
  const maxTokens = 200000; // 提高限制，支持更长的播客

  if (tokenCount > maxTokens) {
    return {
      canProcess: false,
      reason: `文本过长 (${tokenCount.toLocaleString()} tokens)，超过安全限制 (${maxTokens.toLocaleString()} tokens)`
    };
  }

  return { canProcess: true };
}

/**
 * 智能选择处理策略
 * 根据文本长度自动选择整体处理或分块处理
 */
export async function generateReportSmart(input: ReportGenerationInput): Promise<ReportGenerationOutput> {
  const { canProcess, reason } = canProcessAsWhole(input.transcript);
  
  if (canProcess) {
    console.log('使用整体处理策略');
    return await generateReportWhole(input);
  } else {
    console.log(`使用分块处理策略: ${reason}`);
    // 回退到原有的分块处理方法
    const { generateInterviewReport } = await import('@/clients/qwen-text');
    const result = await generateInterviewReport({ transcript: input.transcript, title: input.title });
    return {
      summary: result.summary,
      processingTime: 0, // 分块处理时间计算复杂，这里简化
      estimatedTokens: Math.ceil((input.transcript.length + result.summary.length) / 2)
    };
  }
}
