import { qwenChat, ChatMessage } from './qwen-text';
import { getPrompt } from '@/server/prompt-service';

export interface ReportGenerationInput {
  transcript: string; // 清洗后的访谈全文（A2/A3）或ASR原文
  originalTranscript?: string; // ASR原文（A1）
  segments?: string[]; // ASR分段数组（按时间分割的73段），优先使用此字段进行分块
  title?: string;
  language?: string; // ASR检测到的语言（'en' 或 'zh'），用于决定输出语言
}

export interface ReportGenerationOutput {
  summary: string;
  outline?: string; // 报告大纲/框架（两轮生成的第一轮产出）
  processingTime: number;
  estimatedTokens: number;
}

/**
 * 根据语言生成大纲生成的用户提示词
 */
function getOutlineGenerationPrompt(language?: string, title?: string, primarySource?: string): string {
  const isEnglish = language?.startsWith('en');
  
  if (isEnglish) {
    return `Please generate an extremely detailed podcast report outline/framework based on the ASR transcript (do not introduce external information):

**Podcast Title**: ${title || 'Not provided'}

**ASR Transcript (sole source, generate outline based on this)**:
${primarySource}

**Outline Generation Requirements (Extremely Important!):**

1. **Comprehensively identify all themes and viewpoints (must be complete)**
   - Carefully read **every word** of the ASR transcript, ensure no content is missed
   - Identify **all** main themes, secondary themes, sub-themes
   - Extract **all** key viewpoints, arguments, cases, data, citations, names, company names, numbers under **each** theme
   - **Absolutely prohibit** missing any important information, even secondary viewpoints must be included

2. **Build an extremely detailed framework**
   - Create a chapter for **each** main theme (do not merge themes)
   - Each chapter must include:
     * Theme name (clear and explicit)
     * **All** key viewpoints (do not only list the most important, list all)
     * **All** important argument points (arguments supporting each viewpoint)
     * **All** related cases (specific cases, stories, examples)
     * **All** data, numbers, statistical information
     * **All** names, company names, organization names, place names
     * **All** citations, quotes, important expressions
   - Clarify logical relationships and chronological order between themes
   - Mark the importance of each viewpoint (core/important/secondary), but **do not omit because it's marked as secondary**

3. **Output format requirements**
   - Use Markdown format
   - Use heading levels (#, ##, ###) to organize structure
   - **Each theme must list all key viewpoints and points** (do not only list titles)
   - Use lists or paragraphs to elaborate each viewpoint
   - Maintain clear logic for subsequent expansion

4. **Detail level requirements (Critical!)**
   - The outline should be **extremely detailed**, like a "detailed table of contents"
   - Not only list themes, but also list **all** sub-viewpoints under each theme
   - Not only list viewpoints, but also list **key arguments** supporting viewpoints
   - Not only list arguments, but also list **specific cases and data**
   - Goal: Let readers understand the **entire** core content of the podcast just by reading the outline

**Important Requirements (Must Strictly Follow):**
- ✅ **Must cover all themes and viewpoints in the ASR transcript** (including main and secondary)
- ✅ **Outline should be extremely detailed**, containing **all** key viewpoints, arguments, cases, data under each theme
- ✅ **Comprehensiveness over length**: The outline should be as detailed as necessary to cover all important content, but length is determined by information density, not a fixed target
- ✅ **Do not over-compress**, ensure **all important information** is in the outline
- ✅ **Do not omit secondary viewpoints**, even secondary viewpoints must be included
- ✅ **Do not omit data**, all numbers and statistical information must be included
- ✅ **Do not omit cases**, all specific cases and stories must be included
- ✅ **Do not omit names and company names**, all mentioned entities must be included

**Example Format (Reference):**
\`\`\`
# Theme One: XXX

## Core Viewpoint A
- Detailed description of Viewpoint A
- Supporting Argument 1: Specific explanation
- Supporting Argument 2: Specific explanation
- Case 1: Specific case description
- Data: Specific numbers and statistics

## Core Viewpoint B
- Detailed description of Viewpoint B
- Supporting arguments...
- Cases...

## Secondary Viewpoint C (Although secondary, must be included)
- Description of Viewpoint C
- Related arguments...

# Theme Two: YYY
...
\`\`\`

**Final Reminder:**
- This outline will be used to generate the final report. If the outline misses content, the final report will also miss it
- **Better to make the outline comprehensive than to miss any important information**
- **Goal is to make the outline a "detailed table of contents" that fully covers all important content, with length determined by information density**

Please generate an extremely detailed, complete, and clearly structured report outline.`;
  } else {
    return `请基于ASR原文生成一份极其详细的播客报告大纲/框架（不得引入外部信息）：

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
- ✅ **全面性优于长度**：大纲应该足够详细以覆盖所有重要内容，但长度由信息密度决定，而不是固定目标
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
- **宁可大纲更全面，也不要遗漏任何重要信息**
- **目标是让大纲成为一份"详细目录"，全面覆盖所有重要内容，长度由信息密度决定**

请生成一份极其详细、完整、结构清晰的报告大纲。`;
  }
}

/**
 * 根据语言生成第二轮报告生成的用户提示词
 */
function getReportGenerationPrompt(language?: string, title?: string, outline?: string, primarySource?: string): string {
  const isEnglish = language?.startsWith('en');
  
  if (isEnglish) {
    return `Please generate a complete and detailed podcast summary/report based on the following report outline and ASR transcript (do not introduce external information):

**Podcast Title**: ${title || 'Not provided'}

**Report Outline/Framework (This is your blueprint for generating the report, you must strictly follow this structure)**:
${outline}

**ASR Transcript (Complete content, used to fill each section of the outline)**:
${primarySource}

**Report Structure Requirements (Must Strictly Follow):**

1. **Report must begin with overall content summary (Executive Summary)**
   - At the very beginning of the report, you must add a "**Report Overview**" or "**Executive Summary**" section
   - Use 2-3 complete paragraphs to highly summarize the core theme, main viewpoints, key findings, and overall value of the entire podcast
   - This overview should allow readers to fully understand the overall framework and core content of the podcast before reading the detailed content
   - The overview should cover all main themes, but in a highly summarized manner

2. **Strictly follow outline structure (Highest priority)**
   - **Must** organize the report according to all themes and chapters in the outline, maintaining the outline's structure and order
   - **Must** ensure that **every** theme and **every** viewpoint listed in the outline is detailed in the report
   - **Absolutely prohibit** missing any content in the outline, even viewpoints marked as "secondary" must be included
   - If there are 10 themes in the outline, there must be 10 themes in the report; if there are 50 viewpoints in the outline, there must be 50 viewpoints in the report

3. **Fully expand each section (Based on outline + ASR transcript, provide detailed arguments, cases, and data)**
   - For **each** viewpoint in the outline, **must** find corresponding detailed content in the ASR transcript
   - Expand each viewpoint in the outline into detailed argumentation, **must include**:
     * **Complete argumentation**: Detailed description based on ASR transcript, do not only write viewpoint titles
     * **Detailed arguments**: Find all arguments supporting each viewpoint from the ASR transcript, detail the logical chain of each argument
     * **Specific cases**: Find all related cases, stories, examples from the ASR transcript, provide complete case descriptions (including background, process, results)
     * **Accurate data**: Find all data, numbers, statistical information, research results from the ASR transcript, ensure numerical accuracy
     * **Complete information**: Find all names, company names, organization names, place names, times, citations, etc. from the ASR transcript
     * **Important quote excerpts**: Extract 1-2 quotes from the ASR transcript that best reflect the viewpoint, use Markdown quote format (> quote content) to highlight, increasing the report's authenticity and persuasiveness
   - **Important**: Do not only list viewpoints, expand in depth. For each viewpoint, provide at least 2-3 detailed arguments or cases, and 1-2 important quote excerpts
   - Use long sentences and coherent paragraphs, avoid scattered listings
   - **Do not** only list viewpoint titles, detail each viewpoint

4. **Ensure comprehensive coverage (Double check)**
   - First ensure all content in the outline is included (this is the first priority)
   - Then check the ASR transcript, if important content not in the outline is found, also supplement it to the report
   - Ensure the report completely covers all core content of the podcast

**Workflow Suggestions:**
1. First carefully read the outline and ASR transcript, understand the overall structure and all themes
2. Write the report overview (2-3 paragraphs, summarize overall content)
3. Process theme by theme according to the outline's order
4. For each theme, find all viewpoints listed in the outline
5. For each viewpoint, find corresponding detailed content in the ASR transcript, including arguments, cases, data
6. Combine viewpoints in the outline with detailed content in the ASR transcript to generate detailed argumentation
7. Final check: Ensure all content in the outline is included, and each viewpoint has sufficient arguments, cases, and data support

**Information Density and Length Principles (Important!):**
- **Density priority**: Report length should be completely determined by the information density of the source content. If the podcast has rich content, dense viewpoints, and complex logic, expand in detail; if the content is shallow, viewpoints are simple, and information is limited, be concise. Do not force expansion to meet word count.
- **Do not compress important content**: Do not delete important information for the sake of brevity, but also do not pad or repeat to reach a certain length
- **Quality over quantity**: Prioritize information value and logical coherence. A concise, high-quality report that fully covers all important content is better than a long, repetitive one.
- **No fixed length target**: There is no minimum length requirement. The report should be as long as necessary to comprehensively cover all important content, but no longer.

**Content Quality Requirements:**
- **Must cover all themes and viewpoints in the outline** (this is a hard requirement, cannot be missed)
- **For each viewpoint, provide a complete logical chain, argumentation process, supporting arguments, and specific cases** (but only if these contents actually exist and have value)
- **Each main viewpoint should have detailed arguments or case support, and important quote excerpts when available** (the number depends on what's actually in the ASR transcript, do not force a specific count)
- **Important quote excerpt requirements**:
  * Extract quotes from ASR transcript that best reflect the core of the viewpoint (can be complete sentences or key fragments)
  * Use Markdown quote format (> quote content) to highlight
  * Quotes should be representative, persuasive, and enhance the report's authenticity
  * Quote excerpts should naturally integrate into the argumentation, not exist in isolation
  * **Do not cite quotes that only repeat what you have already summarized** - citations should provide additional value (specific data, unique expressions, golden quotes, etc.)
- **All arguments, cases, data, quotes must come from the ASR transcript, do not fabricate or speculate**
- Use long sentences and coherent paragraphs, maintain logical coherence, form complete argumentation chains
- **Avoid repetition**: Do not repeat the same viewpoint in different words, ensure each sentence provides new information increment
- **The outline is your blueprint, the ASR transcript is your material library, combine both to generate the final report**

**Special Reminders:**
- The outline has already identified all important content, your task is to fill each section with detailed content from the ASR transcript according to the outline's structure
- If the outline lists a viewpoint but you cannot find corresponding content in the ASR transcript, the outline may be wrong, in which case you should generate that viewpoint based on the ASR transcript
- If there is important content in the ASR transcript not in the outline, the outline may have missed it, in which case you should supplement it to the report
- **Remember: Report length is determined by information density, not by a fixed target. Focus on quality, comprehensiveness, and avoiding repetition, not on reaching a certain length.**

Please generate a complete, coherent, professional, detailed, and comprehensive report.`;
  } else {
    return `请基于以下报告大纲和ASR原文，生成一份完整、详尽的播客总结/报告（不得引入外部信息）：

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

**信息密度与长度原则（重要！）：**
- **密度优先**：报告长度应完全取决于源内容的信息密度。如果播客内容干货多、观点密集、逻辑复杂，请详尽展开；如果内容较浅、观点简单、信息量有限，请简明扼要。不要为了凑字数而强行扩写。
- **不要压缩重要内容**：不要为了简洁而删除重要信息，但也不要为了达到某个长度而注水或重复
- **质量优于数量**：优先考虑信息价值和逻辑连贯性。一份简洁、高质量、全面覆盖所有重要内容的报告，优于一份冗长、重复的报告。
- **无固定长度目标**：没有最低长度要求。报告应该足够长以全面覆盖所有重要内容，但不应更长。

**内容质量要求：**
- **必须覆盖大纲中的所有主题和观点**（这是硬性要求，不能遗漏）
- **对每个观点都要提供完整的逻辑链条、论证过程、支撑论据和具体案例**（但前提是这些内容确实存在且有价值）
- **每个主要观点应该有详细论据或案例支撑，以及重要原话摘录（如果可用）**（数量取决于ASR原文中实际存在的内容，不要强制要求特定数量）
- **重要原话摘录要求**：
  * 从ASR原文中摘录最能体现观点核心的原话（可以是完整句子或关键片段）
  * 使用Markdown引用格式（> 原话内容）突出显示
  * 原话应该具有代表性、说服力，能够增强报告的真实性
  * 原话摘录应该自然地融入论述中，不要孤立存在
  * **不要引用那些只是重复你已经总结过的内容** - 引用应该提供额外价值（具体数据、独特表达、金句等）
- **所有论据、案例、数据、原话都必须来自ASR原文，不得编造或推测**
- 使用长句子和连贯段落，保持逻辑连贯，形成完整的论述链条
- **避免重复**：不要用不同的话重复表达相同的观点，确保每句话都提供新的信息增量
- **大纲是你的蓝图，ASR原文是你的素材库，两者结合生成最终报告**

**特别提醒：**
- 大纲已经识别了所有重要内容，你的任务是按照大纲的结构，用ASR原文的详细内容填充每个部分
- 如果大纲中列出了某个观点，但你在ASR原文中找不到对应内容，说明大纲可能有误，此时应该基于ASR原文生成该观点
- 如果ASR原文中有重要内容未在大纲中，说明大纲可能遗漏，此时应该补充到报告中
- **记住：报告长度由信息密度决定，而不是固定目标。专注于质量、全面性和避免重复，而不是达到某个长度。**

请生成一份完整、连贯、专业、详尽且全面的报告。`;
  }
}

/**
 * 根据语言生成两轮生成的追加提示词
 */
function getTwoStageAdditionalPrompt(language?: string): string {
  const isEnglish = language?.startsWith('en');
  
  if (isEnglish) {
    // 英文两轮生成的追加内容
    return `

**Important Constraints:**
- Write only based on the podcast content provided, do not introduce external information
- Conflict handling: Follow the ASR transcript, maintain the original meaning
- Information priority: Cover all key viewpoints, data, cases and logic, ensure information completeness

**Information Density and Length Principles (Important!):**
- **Density priority**: Report length should be completely determined by the information density of the source content. If the podcast has rich content, dense viewpoints, and complex logic, expand in detail; if the content is shallow, viewpoints are simple, and information is limited, be concise. Do not force expansion to meet word count.
- **MECE principle**: Ensure viewpoints are mutually exclusive and collectively exhaustive. Do not miss key information, and do not repeat the same logic. Each viewpoint, argument, and case should provide new information increment.
- **Comprehensive coverage**: Must cover all main viewpoints, secondary viewpoints, related arguments, specific cases, data, citations, and details mentioned in the podcast, but based on information density, do not repeat or pad for length.
- **Deep expansion**: For each viewpoint, provide a complete logical chain, argumentation process, supporting arguments, and specific cases, but only if these contents actually exist and have value. Do not fabricate or force expansion.

**Writing Style Requirements (Critical!):**
1. **Long sentences priority**: Use complete, complex long sentences for in-depth elaboration, each paragraph should contain multiple interrelated sentences, forming a complete argumentation chain
2. **Avoid scattered style**: Do not use many short sentences or bullet points to list viewpoints, but integrate multiple related viewpoints into coherent paragraphs
3. **Logical coherence**: Each paragraph internally and between paragraphs should have clear logical connections, using transition words and connectors (such as "therefore", "however", "furthermore", "specifically", "notably", etc.)
4. **Deep elaboration**: For each important viewpoint, not only propose it, but also deeply explain its background, reasons, impact, and significance
5. **Professional terminology**: Use professional, formal language, avoid colloquial expressions
6. **Third-person objective**: Present viewpoints from an objective, professional third-person perspective, do not label speaker identities
7. **Complete argumentation**: Each viewpoint should include a complete argumentation structure: argument-evidence-case-conclusion

**Report Structure (Maintain existing structure):**
- **Introduction**: Overview of podcast theme, background and main topics, use 1-2 complete paragraphs for in-depth introduction
- **Core viewpoints**: Organize main viewpoints and arguments by theme, each theme uses multiple coherent long paragraphs for in-depth elaboration
  - Each viewpoint should include: complete argumentation, supporting arguments, specific cases, data or citations
  - **Citation logic (Critical correction)**:
    * **Citation as evidence**: Quote excerpts serve to support your argumentation, or to preserve the guest's unique expression style, strong emotional expression, specific data or golden quotes
    * **Prohibit synonymous repetition**: Strictly prohibit "AI summarizes A, then immediately quotes a sentence that also means A". This is serious repetitive redundancy and must be avoided
    * **Correct approach**: AI is responsible for elaborating viewpoints and logical background, citations are responsible for showing specific data, golden quotes, unique expressions or strong emotional expressions. Citations should be embedded in the argumentation logic, complementing rather than repeating the context
    * **Citation selection criteria**: Only cite content that provides additional value, such as: specific numbers, statistical data, unique metaphors, golden quotes, strong emotional expressions, original expressions of professional terms, etc. If the original quote only repeats viewpoints you have already summarized, it should not be cited
  - Use long sentences to integrate related viewpoints, arguments, cases into coherent paragraphs
  - Avoid simple bullet point listings, but integrate multiple points into logically coherent argumentation
- **Secondary viewpoints and details**: Supplement secondary viewpoints, related discussions, specific details, etc., also use long paragraphs for elaboration
- **Summary and insights**: Extract core insights and discussion value, use 1-2 complete paragraphs for summary

**Format Requirements:**
- **Prioritize paragraphs**: Each section mainly consists of multiple coherent paragraphs, rather than bullet point lists
- **Use bullet points cautiously**: Only use bullet points when necessary (such as listing multiple independent data points, technical indicators, etc.), but even for list items, try to use complete sentences
- **Use Markdown format**: Use titles, paragraphs, bold, etc. to organize content
- **Paragraph length**: Each paragraph should contain 3-5 complete long sentences, forming a complete argumentation unit

**Output Requirements:**
- Remove oral language, redundant sentences, repetitive information
- Use formal, clear, logical written language
- Maintain clear logic, highlight core viewpoints
- Avoid colloquial expressions
- **Maximize information value**: Prioritize retaining all important viewpoints, arguments, cases, and data, but ensure each content provides new information increment
- **Absolutely prohibit adding content**: Do not add any information, viewpoints, or explanations not mentioned in the podcast
- **Faithful to original principle**: All content must be strictly based on the provided content, no additions allowed
- **Deduplication check (Critical!)**: When generating each paragraph, self-check for "repetitive talk" or "synonymous repetition", ensure each sentence provides new information increment. Specifically check:
  * Whether you cited an original quote with the same meaning after AI summary
  * Whether you repeated the same viewpoint in different paragraphs
  * Whether you forced expansion of simple viewpoints to meet word count
  * Whether you already expressed the same meaning in AI's words before citing
- **Information density oriented**: Report length is completely determined by content information density, do not pad to reach a certain length target

**Important Reminders:**
- Report length is completely determined by content information density, do not pad or repeat to reach a certain length target
- Ensure each viewpoint, argument, case, citation provides new information increment, avoid synonymous repetition
- Citations should serve as evidence or preserve unique expressions, not repeat what AI has already summarized
- Goal: Let readers fully understand the core content of the podcast through the report, without needing to listen to the original audio
- **Style goal**: Generate a professional report like McKinsey research reports or investment company research reports, suitable for in-depth reading, logically rigorous, with complete argumentation`;
  } else {
    // 中文两轮生成的追加内容（原有内容）
    return `

**重要限制：**
- 仅基于本次提供的播客内容撰写，禁止引入外部信息
- 冲突处理：以 ASR 原文为准，保持原意
- 信息优先：覆盖所有关键观点、数据、案例与逻辑，确保信息完整性

**信息密度与长度原则（重要！）：**
- **密度优先**：报告长度应完全取决于源内容的信息密度。如果播客内容干货多、观点密集、逻辑复杂，请详尽展开；如果内容较浅、观点简单、信息量有限，请简明扼要。不要为了凑字数而强行扩写。
- **MECE原则**：确保观点相互独立、完全穷尽（Mutually Exclusive, Collectively Exhaustive）。不遗漏关键信息，也不重复相同逻辑。每个观点、论据、案例都应该提供新的信息增量。
- **全面覆盖**：必须覆盖播客中提到的所有主要观点、次要观点、相关论据、具体案例、数据、引用和细节，但以信息密度为准，不要为了长度而重复或注水。
- **深度展开**：对每个观点都要提供完整的逻辑链条、论证过程、支撑论据和具体案例，但前提是这些内容确实存在且有价值。不要无中生有或强行展开。

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
  - **引用逻辑（关键修正）**：
    * **引用即证据**：原话摘录（Quotes）的作用是佐证你的论述，或者是为了保留嘉宾独特的表达风味、强烈的情绪表达、具体的数据或金句
    * **禁止同义重复**：严禁出现"AI总结说A，然后紧接着引用一句意思也是A的原话"的情况。这是严重的重复啰嗦，必须避免
    * **正确做法**：AI负责阐述观点和逻辑背景，引用负责展示具体数据、金句、独特的表达方式或强烈的情绪表达。引用应嵌入到论证逻辑中，与上下文形成互补而非重复
    * **引用选择标准**：只引用那些能够提供额外价值的内容，如：具体数字、统计数据、独特的比喻、金句、强烈的情感表达、专业术语的原始表述等。如果原话只是重复你已经总结过的观点，则不应引用
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
- **最大化信息价值**：优先保留所有重要的观点、论据、案例和数据，但确保每个内容都提供新的信息增量
- **绝对禁止添加内容**：不得添加任何播客中未提及的信息、观点或解释
- **忠实原文原则**：所有内容必须严格基于本次提供的内容，不得有任何新增
- **去重检查（关键！）**：在生成每个段落时，自我检查是否存在"车轱辘话"或"同义反复"，确保每一句话都能提供新的信息增量。特别检查：
  * 是否在AI总结后又引用了意思完全相同的原话
  * 是否在不同段落中重复表达相同的观点
  * 是否为了凑字数而强行扩写简单观点
  * 是否在引用前已经用AI的话表达了相同的意思
- **信息密度导向**：报告长度完全由内容的信息密度决定，不要为了达到某个长度目标而注水

**写作示例（参考风格）：**
- ❌ 避免：使用大量短句和项目符号
  - 观点A
  - 观点B
  - 观点C
  
- ✅ 推荐：使用长句子和连贯段落
  "在深入分析这一现象时，我们首先需要理解其背后的根本原因。通过对比多个案例，我们可以发现，这一趋势并非偶然出现，而是多种因素共同作用的结果。具体而言，技术发展的推动、市场需求的演变以及监管环境的变化，共同构成了这一现象产生的背景。值得注意的是，这些因素之间并非简单的线性关系，而是相互影响、相互强化的复杂系统。因此，要全面理解这一现象，我们需要采用系统性的分析方法，从多个维度进行深入探讨。"

**引用示例（关键修正）：**
- ❌ 错误做法（同义重复）：
  "技术发展推动了市场变化，这一趋势不可逆转，未来将更加依赖AI。通过对比多个案例可以发现，这一变化已经在多个行业中得到验证。> 技术发展推动了市场变化，这一趋势不可逆转，未来将更加依赖AI。"
  * 问题：AI总结和引用表达的是完全相同的意思，这是严重的重复啰嗦

- ✅ 正确做法（互补而非重复）：
  "技术发展推动了市场变化，这一趋势不可逆转，未来将更加依赖AI。通过对比多个案例可以发现，这一变化已经在多个行业中得到验证。正如某位专家所言：> '我们预计在未来三年内，AI将渗透到90%以上的传统行业，这不仅仅是技术升级，更是商业模式的根本性变革。'"
  * 优势：AI负责阐述观点和逻辑，引用提供具体数据（"90%"）和独特表达（"不仅仅是技术升级，更是商业模式的根本性变革"），两者互补而非重复

**重要提醒：**
- 报告长度完全由内容的信息密度决定，不要为了达到某个长度目标而注水或重复
- 确保每个观点、论据、案例、引用都提供新的信息增量，避免同义反复
- 引用应作为证据或保留独特表达，而不是重复AI已经总结过的内容
- 目标是让读者通过报告就能全面了解播客的核心内容，而不需要去听原音频
- **风格目标**：生成一份像麦肯锡研究报告或投资公司研报那样，适合深度阅读、逻辑严密、论述完整的专业报告

**执行步骤（思维链 Chain of Thought）：**
在开始撰写报告前，请按照以下步骤进行思考和规划，确保逻辑顺畅、结构清晰：

**Step 1 全局分析**：先通读全文，识别核心论点和逻辑架构。理解播客的整体主题、主要讨论的问题、各观点之间的逻辑关系，以及信息的层次结构。

**Step 2 筛选引用**：挑选出能佐证观点的"金句"和数据，剔除单纯的口语表达。识别那些能够提供额外价值的内容（具体数字、统计数据、独特的比喻、金句、强烈的情感表达、专业术语的原始表述等），避免选择那些只是重复你已经总结过的观点的原话。

**Step 3 逻辑重组**：运用MECE原则构建报告框架。确保观点相互独立、完全穷尽，不遗漏关键信息，也不重复相同逻辑。按照信息密度决定每个部分的展开程度，不要为了凑字数而强行扩写。

**Step 4 撰写与自查**：开始撰写报告，并实时进行去重检查，确保没有同义反复。在生成每个段落时，自我检查是否存在"车轱辘话"或"同义反复"，特别检查是否在AI总结后又引用了意思完全相同的原话。`;
  }
}

/**
 * 根据语言生成相应的提示词
 */
function getSystemPromptByLanguage(language?: string, basePrompt?: string): string {
  // 更宽松的英文检测：支持 "en", "en-US", "english" 等格式
  const isEnglish = language?.startsWith('en') || 
                   language?.includes('en') || 
                   language?.toLowerCase() === 'english';
  console.log(`[getSystemPromptByLanguage] 语言检测: language=${language}, isEnglish=${isEnglish}`);
  
  if (isEnglish) {
    console.log(`[getSystemPromptByLanguage] 使用英文提示词（要求输出英文总结）`);
    // 英文播客：完全使用英文提示词，要求输出英文总结
    // 基于中文提示词翻译，但删除"输出为中文"的要求
    return `You are a former McKinsey Global Partner, former Harvard Psychology Professor, and current Alibaba Strategy Department Head. You are an expert with rich experience in strategic consulting, academic research, and business practice.

Please generate a professional podcast summary/report based on the ASR transcript, adopting the style of McKinsey research reports or investment company research reports. The report should be suitable for in-depth reading, using complete long sentences for in-depth elaboration, avoiding scattered short sentence listings.

**Important: Output Language Requirements**
- The ASR transcript is in English, please generate a high-quality English summary report
- Use professional, fluent English for summarization, maintaining the original professional terminology and expression style
- Ensure accurate understanding of English content, including professional terms, cultural background, specific cases and data
- The output must be a fluent, professional, and authentic English report that meets the reading habits of English readers

**Important Constraints:**
- Write only based on the podcast content provided, do not introduce external information
- Conflict handling: Follow the ASR transcript, maintain the original meaning
- Information priority: Cover all key viewpoints, data, cases and logic, ensure information completeness

**Information Density and Comprehensiveness Requirements (Important!):**
- **Density priority**: Report length should be completely determined by the information density of the source content. If the podcast has rich content, dense viewpoints, and complex logic, expand in detail; if the content is shallow, viewpoints are simple, and information is limited, be concise. Do not force expansion to meet word count.
- **Comprehensive coverage**: Must cover all main viewpoints, secondary viewpoints, related arguments, specific cases, data, citations, and details mentioned in the podcast
- **Do not over-compress**: Do not delete important information for the sake of brevity, but also do not pad or repeat to reach a certain length
- **Deep expansion**: For each viewpoint, provide a complete logical chain, argumentation process, supporting arguments, and specific cases, but only if these contents actually exist and have value. Do not fabricate or force expansion.
- **Quality over quantity**: Prioritize information value and logical coherence over report length. A concise, high-quality report is better than a long, repetitive one.

**Writing Style Requirements (Critical!):**
1. **Long sentences priority**: Use complete, complex long sentences for in-depth elaboration. Each paragraph should contain multiple interrelated sentences, forming a complete argumentation chain
2. **Avoid scattered style**: Do not use many short sentences or bullet points to list viewpoints. Instead, integrate multiple related viewpoints into coherent paragraphs
3. **Logical coherence**: Each paragraph internally and between paragraphs should have clear logical connections, using transition words and connectors (such as "therefore", "however", "furthermore", "specifically", "notably", etc.)
4. **Deep elaboration**: For each important viewpoint, not only propose it, but also deeply explain its background, reasons, impact, and significance
5. **Professional terminology**: Use professional, formal language, avoid colloquial expressions
6. **Third-person objective**: Present viewpoints from an objective, professional third-person perspective, do not label speaker identities
7. **Complete argumentation**: Each viewpoint should include a complete argumentation structure: argument-evidence-case-conclusion

**Report Structure (Maintain existing structure):**
- **Introduction**: Overview of podcast theme, background and main topics, use 1-2 complete paragraphs for in-depth introduction
- **Core viewpoints**: Organize main viewpoints and arguments by theme, each theme uses multiple coherent long paragraphs for in-depth elaboration
  - Each viewpoint should include: complete argumentation, supporting arguments, specific cases, data or citations
  - **Important quote excerpts**: Each main viewpoint should include 1-2 quote excerpts that best reflect the viewpoint, using Markdown quote format (> quote content) to highlight, increasing the authenticity and persuasiveness of the report
  - Use long sentences to integrate related viewpoints, arguments, cases into coherent paragraphs
  - Avoid simple bullet point listings, but integrate multiple points into logically coherent argumentation
- **Secondary viewpoints and details**: Supplement secondary viewpoints, related discussions, specific details, etc., also use long paragraphs for elaboration
- **Summary and insights**: Extract core insights and discussion value, use 1-2 complete paragraphs for summary

**Format Requirements:**
- **Prioritize paragraphs**: Each section mainly consists of multiple coherent paragraphs, rather than bullet point lists
- **Use bullet points cautiously**: Only use bullet points when necessary (such as listing multiple independent data points, technical indicators, etc.), but even for list items, try to use complete sentences
- **Use Markdown format**: Use titles, paragraphs, bold, etc. to organize content
- **Paragraph length**: Each paragraph should contain 3-5 complete long sentences, forming a complete argumentation unit

**Output Requirements:**
- Remove oral language, redundant sentences, repetitive information
- Use formal, clear, logical written language
- Maintain clear logic, highlight core viewpoints
- Avoid colloquial expressions
- **Maximize information value**: Prioritize retaining all important viewpoints, arguments, cases, and data, but avoid repetition
- **Absolutely prohibit adding content**: Do not add any information, viewpoints, or explanations not mentioned in the podcast
- **Faithful to original principle**: All content must be strictly based on the provided content, no additions allowed
- **No padding or repetition**: Do not repeat the same viewpoint in different words, do not pad content to reach a certain length, ensure each sentence provides new information increment

**Information Density and Length Principles:**
- Density priority: Report length should be completely determined by the information density of the source content, do not force expansion to meet word count
- MECE principle: Ensure viewpoints are mutually exclusive and collectively exhaustive, do not miss key information, and do not repeat the same logic
- Citation logic: Prohibit synonymous repetition, citations should serve as evidence or preserve unique expressions, rather than repeating what AI has already summarized
- Deduplication check: Ensure each sentence provides new information increment, avoid "repetitive talk" or "synonymous repetition"

**Important Reminders:**
- Report length is completely determined by content information density, do not pad or repeat to reach a certain length target
- Ensure each viewpoint, argument, case, citation provides new information increment, avoid synonymous repetition
- Do not sacrifice information completeness for brevity, but also do not pad or repeat for length
- Goal: Let readers fully understand the core content of the podcast through the report, without needing to listen to the original audio
- **Style goal**: Generate a professional report like McKinsey research reports or investment company research reports, suitable for in-depth reading, logically rigorous, with complete argumentation, but concise and information-dense`;
  } else {
    // 中文播客：使用数据库提示词或默认中文提示词
    const base = basePrompt || `你是前麦肯锡全球合伙人，前哈佛大学心理系教授，现阿里巴巴战略部负责人。你是一位拥有丰富战略咨询、学术研究和商业实践经验的专家。

请基于ASR原文生成一份专业的播客总结/报告，采用麦肯锡研究报告或投资公司研报的风格。报告应该适合深度阅读，使用完整的长句子进行深入阐述，避免散点式的短句罗列。`;

    // 如果数据库提示词中没有多语言支持说明，添加它
    if (basePrompt && !basePrompt.includes('多语言支持') && !basePrompt.includes('无论ASR原文')) {
      return `${base}

**重要：多语言支持**
- 无论ASR原文是中文还是英文，都必须生成高质量的中文总结报告
- 如果ASR原文是英文，请先准确理解英文内容的含义，包括专业术语、文化背景、具体案例和数据
- 确保英文专业术语的准确翻译和理解，保持原意的完整性和准确性
- 输出必须是流畅、专业的中文报告，符合中文读者的阅读习惯

**信息密度与长度原则：**
- 密度优先：报告长度应完全取决于源内容的信息密度，不要为了凑字数而强行扩写
- MECE原则：确保观点相互独立、完全穷尽，不遗漏关键信息，也不重复相同逻辑
- 引用逻辑：禁止同义重复，引用应作为证据或保留独特表达，而不是重复AI已总结的内容
- 去重检查：确保每句话都提供新的信息增量，避免"车轱辘话"或"同义反复"`;
    }
    // 如果数据库提示词已经包含多语言支持说明，直接使用
    return base;
  }
}

/**
 * 单轮生成访谈报告
 * 直接基于ASR原文生成完整报告，使用 qwen3-max 模型
 * 统一使用单轮生成，避免两轮生成导致的信息丢失和结构固化问题
 */
export async function generateReportWhole(input: ReportGenerationInput, fromChunked: boolean = false): Promise<ReportGenerationOutput> {
  const { transcript, originalTranscript, title, segments, language } = input;
  const startTime = Date.now();
  
  // 检查输入长度限制（qwen3-max 支持最大 252K tokens 输入，256K 上下文）
  // 设置安全边界为 240K tokens，留 12K 余量用于提示词
  const transcriptLength = transcript.length;
  const estimatedTokens = transcriptLength; // 中文约1字符=1token
  const promptTokens = 10000; // 估算提示词长度（包括系统提示词和用户提示词）
  const totalInputTokens = estimatedTokens + promptTokens;
  const maxInputTokens = 240000; // 安全边界（252K限制，留12K余量）
  
  // 如果输入超过限制，直接使用分块处理
  // 但如果是从分块处理调用的，避免递归，直接抛出错误
  if (totalInputTokens > maxInputTokens) {
    if (fromChunked) {
      throw new Error(`输入长度超限 (${totalInputTokens.toLocaleString()} tokens > ${maxInputTokens.toLocaleString()} tokens)，且已从分块处理调用，避免递归`);
    }
    console.warn(`⚠️ 输入长度超限 (${totalInputTokens.toLocaleString()} tokens > ${maxInputTokens.toLocaleString()} tokens)，自动切换到分块处理模式`);
    console.log(`   ASR原文: ${transcriptLength.toLocaleString()} 字符`);
    console.log(`   估算总输入: ${totalInputTokens.toLocaleString()} tokens`);
    console.log(`   注意：qwen3-max 支持最大 252K tokens 输入，超过 240K 时使用分块处理`);
    return await generateReportChunked(input);
  }
  
  // 统一使用单轮生成（直接基于ASR原文生成总结）
  // 使用 qwen3-max 模型，支持更大的上下文窗口和更好的理解能力
  const segmentCount = segments?.length || 0;
  console.log(`使用单轮生成模式，文本长度: ${transcript.length} 字符，段落数: ${segmentCount}`);
  
  // 获取系统提示词
  let basePrompt: string | undefined;
  try {
    basePrompt = await getPrompt('report_generation_whole');
  } catch (error) {
    console.warn('Failed to get dynamic prompt, using fallback:', error);
  }
  
  const systemPrompt = getSystemPromptByLanguage(language, basePrompt);
  return await generateReportWholeFallback(input, systemPrompt, fromChunked);
}

/**
 * 根据语言生成单轮生成的用户提示词
 */
function getSingleStageUserPrompt(language?: string, title?: string, transcript?: string): string {
  const isEnglish = language?.startsWith('en') || 
                   language?.includes('en') || 
                   language?.toLowerCase() === 'english';
  
  if (isEnglish) {
    return `Please generate a comprehensive and detailed podcast summary/report based on the ASR transcript (do not introduce external information):

**Podcast Title**: ${title || 'Not provided'}

**ASR Transcript (sole source, generate report based on this)**:
${transcript}

**Report Structure Requirements (Must Strictly Follow):**

1. **Report must begin with overall content summary (Executive Summary)**
   - At the very beginning of the report, you must add a "**Report Overview**" or "**Executive Summary**" section
   - Use 2-3 complete paragraphs to highly summarize the core theme, main viewpoints, key findings, and overall value of the entire podcast
   - This overview should allow readers to fully understand the overall framework and core content of the podcast before reading the detailed content
   - The overview should cover all main themes, but in a highly summarized manner

2. **Fully expand each section (Based on ASR transcript, provide detailed arguments, cases, and data)**
   - For **each** main viewpoint in the ASR transcript, **must** provide detailed expansion, including:
     * **Complete argumentation**: Detailed description based on ASR transcript, do not only write viewpoint titles
     * **Detailed arguments**: Find all arguments supporting each viewpoint from the ASR transcript, detail the logical chain of each argument
     * **Specific cases**: Find all related cases, stories, examples from the ASR transcript, provide complete case descriptions (including background, process, results)
     * **Accurate data**: Find all data, numbers, statistical information, research results from the ASR transcript, ensure numerical accuracy
     * **Complete information**: Find all names, company names, organization names, place names, times, citations, etc. from the ASR transcript
     * **Important quote excerpts**: Extract 1-2 quotes from the ASR transcript that best reflect the viewpoint, use Markdown quote format (> quote content) to highlight, increasing the report's authenticity and persuasiveness
   - **Important**: Do not only list viewpoints, expand in depth. For each main viewpoint, provide at least 2-3 detailed arguments or cases, and 1-2 important quote excerpts
   - Use long sentences and coherent paragraphs, avoid scattered listings

**Information Density and Length Principles (Important!):**
- **Density priority**: Report length should be completely determined by the information density of the source content. If the podcast has rich content, dense viewpoints, and complex logic, expand in detail; if the content is shallow, viewpoints are simple, and information is limited, be concise. Do not force expansion to meet word count.
- **Do not compress important content**: Do not delete important information for the sake of brevity, but also do not pad or repeat to reach a certain length
- **Quality over quantity**: Prioritize information value and logical coherence. A concise, high-quality report that fully covers all important content is better than a long, repetitive one.
- **No fixed length target**: There is no minimum length requirement. The report should be as long as necessary to comprehensively cover all important content, but no longer.

**Content Quality Requirements:**
- **Must cover all main viewpoints, secondary viewpoints, related arguments, specific cases, data, citations, and details**
- **For each main viewpoint, provide a complete logical chain, argumentation process, supporting arguments, and specific cases** (but only if these contents actually exist and have value)
- **Each main viewpoint should have detailed arguments or case support, and important quote excerpts when available** (the number depends on what's actually in the ASR transcript, do not force a specific count)
- **Important quote excerpt requirements**:
  * Extract quotes from ASR transcript that best reflect the core of the viewpoint (can be complete sentences or key fragments)
  * Use Markdown quote format (> quote content) to highlight
  * Quotes should be representative, persuasive, and enhance the report's authenticity
  * Quote excerpts should naturally integrate into the argumentation, not exist in isolation
  * **Do not cite quotes that only repeat what you have already summarized** - citations should provide additional value (specific data, unique expressions, golden quotes, etc.)
- **All arguments, cases, data, quotes must come from the ASR transcript, do not fabricate or speculate**
- Use long sentences and coherent paragraphs, maintain logical coherence, form complete argumentation chains
- **Avoid repetition**: Do not repeat the same viewpoint in different words, ensure each sentence provides new information increment

**Special Reminders:**
- **Remember: Report length is determined by information density, not by a fixed target. Focus on quality, comprehensiveness, and avoiding repetition, not on reaching a certain length.**
- Goal: Let readers fully understand the core content of the podcast through the report, without needing to listen to the original audio

Please generate a complete, coherent, professional, detailed, and comprehensive report.`;
  } else {
    return `请基于ASR原文生成最详尽的播客总结/报告（不得引入外部信息）：

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

**信息密度与长度原则（重要！）：**
- **密度优先**：报告长度应完全取决于源内容的信息密度。如果播客内容干货多、观点密集、逻辑复杂，请详尽展开；如果内容较浅、观点简单、信息量有限，请简明扼要。不要为了凑字数而强行扩写。
- **不要压缩重要内容**：不要为了简洁而删除重要信息，但也不要为了达到某个长度而注水或重复
- **质量优于数量**：优先考虑信息价值和逻辑连贯性。一份简洁、高质量、全面覆盖所有重要内容的报告，优于一份冗长、重复的报告。
- **无固定长度目标**：没有最低长度要求。报告应该足够长以全面覆盖所有重要内容，但不应更长。

**内容质量要求：**
- **必须覆盖所有主要观点、次要观点、相关论据、具体案例、数据、引用和细节**
- **对每个主要观点都要提供完整的逻辑链条、论证过程、支撑论据和具体案例**（但前提是这些内容确实存在且有价值）
- **每个主要观点应该有详细论据或案例支撑，以及重要原话摘录（如果可用）**（数量取决于ASR原文中实际存在的内容，不要强制要求特定数量）
- **重要原话摘录要求**：
  * 从ASR原文中摘录最能体现观点核心的原话（可以是完整句子或关键片段）
  * 使用Markdown引用格式（> 原话内容）突出显示
  * 原话应该具有代表性、说服力，能够增强报告的真实性
  * 原话摘录应该自然地融入论述中，不要孤立存在
  * **不要引用那些只是重复你已经总结过的内容** - 引用应该提供额外价值（具体数据、独特表达、金句等）
- **所有论据、案例、数据、原话都必须来自ASR原文，不得编造或推测**
- 使用长句子和连贯段落，保持逻辑连贯，形成完整的论述链条
- **避免重复**：不要用不同的话重复表达相同的观点，确保每句话都提供新的信息增量

**特别提醒：**
- **记住：报告长度由信息密度决定，而不是固定目标。专注于质量、全面性和避免重复，而不是达到某个长度。**
- 目标是让读者通过报告就能全面了解播客的核心内容，而不需要去听原音频

请生成一份完整、连贯、专业、详尽且全面的报告。`;
  }
}

/**
 * 单轮生成报告
 * 直接基于ASR原文生成完整报告
 * 如果遇到内容审核错误或API限制，会自动切换到分块处理模式
 */
async function generateReportWholeFallback(
  input: ReportGenerationInput,
  systemPrompt: string,
  fromChunked: boolean = false
): Promise<ReportGenerationOutput> {
  const { transcript, title, language } = input;
  const startTime = Date.now();
  
  console.log('使用单轮生成模式（回退方案）');
  console.log(`[单轮生成] 语言参数: language=${language}`);
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: getSingleStageUserPrompt(language, title, transcript)
    }
  ];
  
  try {
    const summary = await qwenChat(messages, { 
      maxTokens: 64000, // qwen3-max 支持最大 64K tokens 输出
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
    // 但如果是从分块处理调用的，避免递归，直接抛出错误
    if (/内容审核|inappropriate content|输入|input|limit|限制/i.test(errorMessage)) {
      if (fromChunked) {
        console.warn('⚠️ 检测到API限制错误，但已从分块处理调用，避免递归，直接抛出错误');
        throw error;
      }
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
export async function generateReportChunked(input: ReportGenerationInput): Promise<ReportGenerationOutput> {
  const { transcript, originalTranscript, title, segments } = input;
  const startTime = Date.now();
  
  console.log(`开始分块生成报告，文本长度: ${transcript.length} 字符`);
  
  // 优先使用ASR分段（按时间分割的73段），保持语义边界
  let chunks: string[] = [];
  let originalSegments: string[] | undefined = undefined; // 保存原始ASR分段，用于后续合并
  
  if (segments && segments.length > 0) {
    // 使用ASR原有的分段（73段，每段120秒）
    console.log(`✅ 使用ASR原有分段: ${segments.length} 段（保持语义边界）`);
    originalSegments = segments.filter(seg => seg && seg.trim());
    chunks = [...originalSegments]; // 复制一份用于处理
    
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
      // 注意：如果合并了，originalSegments 不再对应 chunks，无法使用优化策略
      originalSegments = undefined;
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
  
  // 获取系统提示词（根据语言）
  const { language } = input;
  let systemPrompt: string;
  try {
    const basePrompt = await getPrompt('report_generation_whole');
    systemPrompt = getSystemPromptByLanguage(language, basePrompt);
  } catch (error) {
    // 回退到根据语言生成默认提示词
    systemPrompt = getSystemPromptByLanguage(language);
  }
  
  // 分别处理每个块，记录成功和失败的块索引
  const reportChunks: string[] = [];
  const successfulChunkIndices: number[] = []; // 记录成功块的索引
  
  console.log(`开始逐个处理 ${chunks.length} 个块，这可能需要较长时间...`);
  console.log(`[分块处理] 语言参数: language=${language}`);
  
  // 根据语言生成分块处理的用户提示词
  const isEnglish = language?.startsWith('en') || 
                   language?.includes('en') || 
                   language?.toLowerCase() === 'english';
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkStartTime = Date.now();
    try {
      // 根据语言生成分块处理的提示词
      const chunkPrompt = isEnglish 
        ? `Please generate a detailed report summary based on the following podcast content segment:

${chunks[i]}

**Requirements (Important!):**
1. **Detailed expansion**: Do not only list viewpoint titles, expand each viewpoint in depth, provide complete logical chains, argumentation processes, supporting arguments, and specific cases
2. **Retain all key information**: Include all main viewpoints, secondary viewpoints, related arguments, specific cases, data, citations, and details
3. **Full expansion**: For each main viewpoint, provide at least 2-3 detailed arguments or case support
4. **Use long sentences and coherent paragraphs**: Avoid scattered listings, use complete long sentences for in-depth elaboration
5. **Length principle**: Each chunk's summary should be fully expanded based on information density, do not over-compress, but also do not pad to reach a certain percentage
6. **Markdown format**: Use titles, paragraphs, bold, etc. Markdown format to organize content

Please generate a detailed, coherent, and professional report summary.`
        : `请基于以下播客内容片段生成详细的报告摘要：

${chunks[i]}

**要求（重要！）：**
1. **详细展开**：不要只列出观点标题，要深入展开每个观点，提供完整的逻辑链条、论证过程、支撑论据和具体案例
2. **保留所有关键信息**：包括所有主要观点、次要观点、相关论据、具体案例、数据、引用和细节
3. **充分展开**：对于每个主要观点，至少提供2-3个详细论据或案例支撑
4. **使用长句子和连贯段落**：避免散点式罗列，使用完整的长句子进行深入阐述
5. **长度原则**：每个块的摘要应该根据信息密度充分展开，不要过度压缩，但也不要为了达到某个百分比而注水
6. **Markdown格式**：使用标题、段落、粗体等Markdown格式组织内容

请生成一份详细、连贯、专业的报告摘要。`;
      
      // 添加超时机制，每个块最多处理5分钟
      const chunkTimeout = 5 * 60 * 1000; // 5分钟
      const chunkPromise = qwenChat([
        { role: "system", content: systemPrompt },
        { role: "user", content: chunkPrompt }
      ], { maxTokens: 10000, temperature: 0.1 });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('块处理超时（超过5分钟）')), chunkTimeout);
      });
      
      const chunkResult = await Promise.race([chunkPromise, timeoutPromise]);
      
      if (chunkResult && chunkResult.trim()) {
        reportChunks.push(chunkResult.trim());
        successfulChunkIndices.push(i);
        const chunkDuration = Date.now() - chunkStartTime;
        const progress = ((i + 1) / chunks.length * 100).toFixed(1);
        console.log(`✅ 块 ${i + 1}/${chunks.length} (${progress}%) 处理成功，长度: ${chunkResult.length} 字符，耗时: ${(chunkDuration / 1000).toFixed(1)}秒`);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const chunkDuration = Date.now() - chunkStartTime;
      const progress = ((i + 1) / chunks.length * 100).toFixed(1);
      
      // 如果某个块也遇到内容审核错误，记录但继续处理其他块
      if (/内容审核|inappropriate content/i.test(errorMessage)) {
        console.warn(`⚠️ 块 ${i + 1}/${chunks.length} (${progress}%) 遇到内容审核错误，跳过该块，耗时: ${(chunkDuration / 1000).toFixed(1)}秒`);
      } else if (/超时|timeout/i.test(errorMessage)) {
        console.warn(`⚠️ 块 ${i + 1}/${chunks.length} (${progress}%) 处理超时，跳过该块，耗时: ${(chunkDuration / 1000).toFixed(1)}秒`);
      } else {
        console.warn(`⚠️ 块 ${i + 1}/${chunks.length} (${progress}%) 处理失败，跳过: ${errorMessage}，耗时: ${(chunkDuration / 1000).toFixed(1)}秒`);
      }
    }
  }
  
  // 如果所有块都失败了，抛出错误
  if (reportChunks.length === 0) {
    throw new Error('所有分块处理均失败，无法生成报告');
  }
  
  const successRate = successfulChunkIndices.length / chunks.length;
  console.log(`分块处理完成: ${successfulChunkIndices.length}/${chunks.length} 成功，成功率: ${(successRate * 100).toFixed(1)}%`);
  
  // 优化策略：如果成功率足够高（>80%）且有原始ASR分段，尝试合并成功的ASR片段走整体处理
  const MIN_SUCCESS_RATE = 0.8; // 最低成功率阈值
  if (successRate >= MIN_SUCCESS_RATE && originalSegments && originalSegments.length > 0) {
    console.log(`✅ 成功率 ${(successRate * 100).toFixed(1)}% 达到阈值 ${(MIN_SUCCESS_RATE * 100)}%，尝试合并成功的ASR片段走整体处理...`);
    
    // 合并成功的ASR片段
    const successfulSegments = successfulChunkIndices
      .map(idx => originalSegments![idx])
      .filter(seg => seg && seg.trim());
    
    const mergedTranscript = successfulSegments.join('\n\n');
    
    // 检查合并后的长度是否在限制内
    const mergedLength = mergedTranscript.length;
    const estimatedTokens = mergedLength; // 中文约1字符=1token
    const promptTokens = 10000;
    const totalInputTokens = estimatedTokens + promptTokens;
    const maxInputTokens = 240000; // qwen3-max 支持最大 252K tokens 输入，设置安全边界 240K
    
    if (totalInputTokens <= maxInputTokens) {
      console.log(`合并后的ASR片段长度: ${mergedLength.toLocaleString()} 字符，估算Token: ${totalInputTokens.toLocaleString()}，在限制内`);
      console.log(`尝试使用整体处理逻辑（单轮或两轮生成）...`);
      
      try {
        // 使用合并后的ASR片段走整体处理逻辑
        // 传递 fromChunked=true 标志，避免递归调用 generateReportChunked
        const wholeResult = await generateReportWhole({
          transcript: mergedTranscript,
          originalTranscript: mergedTranscript,
          segments: successfulSegments, // 传递成功的片段
          title
        }, true); // 标记为从分块处理调用，避免递归
        
        console.log(`✅ 整体处理成功！使用合并后的ASR片段生成报告`);
        return wholeResult;
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ 整体处理失败，回退到分块处理+整合逻辑:`, errorMessage);
        // 继续执行下面的分块处理+整合逻辑
      }
    } else {
      console.log(`⚠️ 合并后的ASR片段长度超限 (${totalInputTokens.toLocaleString()} tokens > ${maxInputTokens.toLocaleString()} tokens)，使用分块处理+整合逻辑`);
    }
  } else {
    if (successRate < MIN_SUCCESS_RATE) {
      console.log(`⚠️ 成功率 ${(successRate * 100).toFixed(1)}% 低于阈值 ${(MIN_SUCCESS_RATE * 100)}%，使用分块处理+整合逻辑`);
    } else if (!originalSegments || originalSegments.length === 0) {
      console.log(`⚠️ 无原始ASR分段，无法使用优化策略，使用分块处理+整合逻辑`);
    }
  }
  
  // 回退到原来的分块处理+整合逻辑
  console.log(`使用分块处理+整合逻辑生成最终报告...`);
  
  // 合并所有块的结果
  const combinedReport = reportChunks.join('\n\n');
  
  // 生成最终整合报告
  let finalSummary = combinedReport;
  if (reportChunks.length > 1) {
    try {
      const finalPrompt = isEnglish
        ? `Please integrate the following multiple report segments into a complete, coherent, and comprehensive podcast summary report:

${combinedReport}

**Integration Requirements (Important!):**
1. **Full expansion rather than compression**: Do not delete important information for the sake of brevity, fully expand each section, provide detailed arguments, cases, and data
2. **Maintain logical coherence**: Ensure smooth logical connections between segments, use transition words and connectors
3. **Remove duplicate content**: Identify and remove duplicate viewpoints and expressions, but do not over-compress
4. **Detailed expansion**: For each main viewpoint, provide a complete logical chain, argumentation process, supporting arguments, and specific cases
5. **Length principle**: Generate as detailed and comprehensive a report as possible based on information density. Do not pad to reach a certain percentage of original content.
6. **Use long sentences and coherent paragraphs**: Avoid scattered listings, use complete long sentences for in-depth elaboration
7. **Markdown format**: Use titles, paragraphs, bold, etc. Markdown format to organize content

**Important Reminders:**
- The goal of integration is to generate a detailed and comprehensive report based on information density, not a compressed summary
- Fully expand each section based on actual content value, do not compress important content, but also do not pad or repeat
- Report length is determined by information density, not by a fixed target

Please generate a complete, coherent, professional, detailed, and comprehensive report.`
        : `请将以下多个报告片段整合成一份完整、连贯、详尽的播客总结报告：

${combinedReport}

**整合要求（重要！）：**
1. **充分展开而非压缩**：不要为了简洁而删除重要信息，要充分展开每个部分，提供详细的论据、案例和数据
2. **保持逻辑连贯**：确保各片段之间的逻辑连接顺畅，使用过渡词和连接词
3. **删除重复内容**：识别并删除重复的观点和表述，但不要过度压缩
4. **详细展开**：对于每个主要观点，要提供完整的逻辑链条、论证过程、支撑论据和具体案例
5. **长度原则**：根据信息密度生成尽可能详尽、全面的报告。不要为了达到原始内容的某个百分比而注水。
6. **使用长句子和连贯段落**：避免散点式罗列，使用完整的长句子进行深入阐述
7. **Markdown格式**：使用标题、段落、粗体等Markdown格式组织内容

**重要提醒**：
- 整合的目标是根据信息密度生成一份详尽、全面的报告，而不是压缩摘要
- 要根据实际内容价值充分展开每个部分，不要压缩重要内容，但也不要注水或重复
- 报告长度由信息密度决定，而不是固定目标

请生成一份完整、连贯、专业、详尽且全面的报告。`;
      
      finalSummary = await qwenChat([
        { role: "system", content: systemPrompt },
        { role: "user", content: finalPrompt }
      ], { maxTokens: 64000, temperature: 0.1 }); // qwen3-max 支持最大 64K tokens 输出
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
  const maxTokens = 240000; // qwen3-max 支持最大 252K tokens 输入，设置安全边界 240K

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
