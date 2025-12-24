# 播客处理完整流程详解

## 📋 目录
1. [前端上传阶段](#前端上传阶段)
2. [API 路由处理](#api-路由处理)
3. [任务队列系统](#任务队列系统)
4. [播客处理核心流程](#播客处理核心流程)
5. [前端轮询与展示](#前端轮询与展示)
6. [详情页数据获取](#详情页数据获取)

---

## 1. 前端上传阶段

### 1.1 用户操作
**位置**: `src/app/home/page.tsx`

**流程**:
1. 用户在首页输入播客链接（URL）
2. 点击"处理"按钮
3. 前端验证 URL 格式

**关键代码**:
```typescript
const handleProcessPodcast = async (url: string) => {
  // 1. 创建本地处理项（用于 UI 显示）
  const processingItem = {
    id: processingId,
    url,
    status: 'processing',
    progress: 0,
    startTime: Date.now(),
    taskId: null
  };
  
  // 2. 保存到 localStorage
  localStorage.setItem('processingPodcasts', JSON.stringify(items));
  
  // 3. 调用 API 提交处理任务
  const res = await fetch('/api/process-audio-async', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  
  // 4. 获取 taskId，开始轮询
  const result = await res.json();
  pollTaskStatus(result.taskId, processingId);
}
```

**API 调用**:
- **端点**: `POST /api/process-audio-async`
- **请求体**: `{ url: string }`
- **响应**: `{ success: true, taskId: string, message: string, estimatedTime: string }`

---

## 2. API 路由处理

### 2.1 异步处理 API
**位置**: `src/app/api/process-audio-async/route.ts`

**流程**:
1. **请求验证**
   - 解析请求体（10秒超时）
   - 验证 URL 格式（使用 `zod` schema）
   - 验证用户认证（必须登录）

2. **权限检查**
   ```typescript
   const limitCheck = await checkUserUploadLimit(user.id, user.role);
   if (!limitCheck.allowed) {
     return jsonError("无权限处理播客", 403);
   }
   ```

3. **创建任务**
   ```typescript
   taskId = await taskQueue.addTask({
     type: 'PODCAST_PROCESSING',
     data: { url, userId: user.id }
   });
   ```

4. **返回响应**
   - 立即返回 `taskId`（不等待处理完成）
   - 前端开始轮询任务状态

**关键点**:
- ✅ 异步处理：API 立即返回，不阻塞
- ✅ 任务队列：使用 `taskQueue` 管理后台任务
- ✅ 权限控制：检查用户上传限制

---

## 3. 任务队列系统

### 3.1 任务队列初始化
**位置**: `src/server/task-queue.ts`

**初始化流程**:
1. 测试数据库连接
2. 清理遗留的 `RUNNING` 状态任务（应用重启后）
3. 启动任务处理循环

**任务处理循环**:
```typescript
// 每 5 秒检查一次待处理任务
setInterval(async () => {
  // 1. 检查是否有空闲槽位（最大并发 3 个）
  if (runningTasks.size >= maxConcurrentTasks) return;
  
  // 2. 获取下一个 PENDING 任务
  const task = await db.taskQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' }
  });
  
  // 3. 标记为 RUNNING，开始处理
  await db.taskQueue.update({
    where: { id: task.id },
    data: { status: 'RUNNING', startedAt: new Date() }
  });
  
  // 4. 调用处理函数（不等待完成）
  processAudioInternal(task.data.url, task.data.userId, task.id)
    .then(() => {
      // 处理成功，更新状态为 READY
    })
    .catch(() => {
      // 处理失败，更新状态为 FAILED
    });
}, 5000);
```

**任务状态流转**:
```
PENDING → RUNNING → READY (成功)
                  → FAILED (失败)
```

---

## 4. 播客处理核心流程

### 4.1 主处理函数
**位置**: `src/server/audio-processor.ts` - `processAudioInternal`

**完整流程**:

#### 步骤 1: 解析播客元数据 ⏱️ ~1-3秒

**API/函数**: `parseUniversalPodcast(url)`
- **位置**: `src/server/parsers/universal-podcast-parser.ts`
- **功能**: 解析播客页面，提取元数据

**处理逻辑**:
1. **判断平台类型**
   - 检查 URL 是否包含 `podcasts.apple.com` → 使用 Apple Podcasts 解析器
   - 检查 URL 是否包含 `xiaoyuzhoufm.com` → 使用小宇宙解析器
   - 其他 → 使用通用解析器

2. **Apple Podcasts 特殊处理**
   ```typescript
   // 设置特定 Headers
   headers['Referer'] = 'https://podcasts.apple.com/';
   headers['Origin'] = 'https://podcasts.apple.com';
   headers['user-agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...';
   
   // 如果直接 fetch 失败，使用代理
   const proxyUrl = `${baseUrl}/api/proxy-audio?url=${encodeURIComponent(url)}`;
   ```

3. **提取元数据**
   - **JSON-LD 提取**: 递归搜索 `@type` 为 `PodcastEpisode` 的对象
   - **音频 URL**: 优先 `associatedMedia.contentUrl` → `contentUrl` → `parts.contentUrl`
   - **正则兜底**: 如果 JSON-LD 失败，使用正则匹配 `*.itunes.apple.com/*.m4a`
   - **标题/作者**: 从 `partOfSeries.name` 提取播客系列名称

**输出**:
```typescript
{
  audioUrl: string,        // 音频文件 URL
  title: string,           // 播客标题
  podcastTitle: string,    // 播客系列名称
  author: string,          // 作者/主持人
  description: string,     // 描述
  publishedAt: string,     // 发布时间
  source: string,          // 数据来源（如 "Apple Podcasts"）
  confidence: number       // 可信度 (0-1)
}
```

**缓存写入**:
```typescript
await setCachedAudio(meta.audioUrl, {
  title: meta.title,
  author: meta.author,
  originalUrl: url,
  publishedAt: meta.publishedAt
});
```

---

#### 步骤 2: ASR 转写（语音转文字）⏱️ ~2-5分钟

**API/函数**: `transcribeWithAliyunASR(audioUrl, language = "auto")`
- **位置**: `src/server/asr.ts`
- **服务**: 阿里云通义千问 ASR 服务（DashScope fun-asr）

**处理流程**:

##### 2.1 音频分段 ⏱️ ~20-40秒
```typescript
// 配置
const ASR_CONFIG = {
  maxDuration: 120,  // 每段 120 秒
  maxConcurrency: 3  // 并发 3 段
};

// 分段策略
const segmentCount = Math.ceil(audioDuration / 120);
// 例如：66分钟音频 = 3987秒 → 34个片段
```

**分段步骤**:
1. 下载完整音频（直接下载或代理下载，最多3次重试）
2. 使用 `ffmpeg` 按 120 秒切割音频
3. 并发切割（3个片段同时进行）
4. 上传片段到阿里云 OSS（并发上传，3个片段同时进行）

##### 2.2 ASR 转写 ⏱️ ~2-4分钟
```typescript
// 并发转写（3个片段同时进行）
const segments = await Promise.all(
  chunkedSegments.map(segment => 
    transcribeSegment(segment, language)  // language = "auto" 自动检测
  )
);
```

**ASR API 调用**:
- **服务**: 阿里云 DashScope fun-asr
- **参数**: 
  - `audioUrl`: OSS 上的音频片段 URL
  - `language`: `"auto"` | `"zh"` | `"en"`（默认 `"auto"` 自动检测）
- **返回**: 
  ```typescript
  {
    transcript: string,      // 转写文本
    language: string,         // 检测到的语言（"zh" | "en"）
    duration: number,        // 音频时长（秒）
    segments: Array<{        // 分段信息
      startTime: number,
      endTime: number,
      text: string
    }>
  }
  ```

##### 2.3 合并结果 ⏱️ ~1秒
```typescript
// 按时间顺序合并所有片段
const fullTranscript = segments
  .sort((a, b) => a.startTime - b.startTime)
  .map(s => s.text)
  .join('\n');
```

**语言检测**:
```typescript
function detectLanguage(asrResult: any): string {
  const lang = (asrResult?.language || "").toLowerCase();
  if (lang.startsWith("en")) return "en";
  if (lang.startsWith("zh")) return "zh";
  return lang || "unknown";
}
```

**输出**:
```typescript
{
  success: true,
  transcript: string,        // 完整 ASR 原文（例如：75,888 字符）
  speakers: Array<{          // 73 个 ASR 片段
    speaker: string,
    startTime: number,
    endTime: number,
    text: string
  }>,
  duration: number,           // 总时长（秒）
  language: string           // 检测到的语言
}
```

**缓存写入**:
```typescript
await setCachedAudio(meta.audioUrl, {
  transcript: asrData.transcript,
  segments: asrData.segments.map(s => JSON.stringify(s))
});
```

**任务指标更新**:
```typescript
await updateTaskMetrics(taskId, {
  asrSegmentsCount: asrData.segments.length,
  processingSteps: {
    asr: { status: 'completed', duration: asrDuration }
  }
});
```

---

#### 步骤 3: 报告生成 ⏱️ ~5-60分钟（取决于文本长度）

**API/函数**: `generateReportWhole(input, fromChunked)`
- **位置**: `src/clients/report-generator.ts`
- **服务**: 通义千问 AI（qwen-text）

**处理流程**:

##### 3.1 语言判断与提示词选择
```typescript
const language = asrData.language || 'unknown';
const isEnglish = language.startsWith('en');

// 根据语言选择提示词
const systemPrompt = getSystemPromptByLanguage(language, basePrompt);
```

**提示词选择逻辑**:
- **英文播客** (`language.startsWith('en')`):
  - 使用**英文提示词**，要求输出**英文总结**
  - 不使用数据库提示词（避免冲突）
  
- **中文播客**:
  - 使用数据库提示词或默认中文提示词
  - 要求输出**中文总结**

##### 3.2 生成策略选择
```typescript
const segmentCount = segments?.length || 0;
const shouldUseTwoStage = segmentCount > 40;

if (!shouldUseTwoStage) {
  // 单轮生成（段落数 ≤ 40）
  return await generateReportWholeFallback(input, systemPrompt, fromChunked);
} else {
  // 两轮生成（段落数 > 40）
  // 第一轮：生成大纲
  // 第二轮：基于大纲生成完整报告
}
```

##### 3.3 单轮生成（段落数 ≤ 40）

**提示词**: `getSystemPromptByLanguage(language, basePrompt)`

**中文提示词**:
```
你是前麦肯锡全球合伙人，前哈佛大学心理系教授，现阿里巴巴战略部负责人。

请基于ASR原文生成一份专业的播客总结/报告，采用麦肯锡研究报告或投资公司研报的风格。

**重要：多语言支持**
- 无论ASR原文是中文还是英文，都必须生成高质量的中文总结报告
- 如果ASR原文是英文，请先准确理解英文内容的含义...

**信息密度与长度原则：**
- 密度优先：报告长度应完全取决于源内容的信息密度...
- MECE原则：确保观点相互独立、完全穷尽...
```

**英文提示词**:
```
You are a former McKinsey Global Partner, former Harvard Psychology Professor...

Please generate a professional podcast summary/report based on the ASR transcript...

**Important: Output Language Requirements**
- The ASR transcript is in English, please generate a high-quality English summary report
- Use professional, fluent English for summarization...
```

**API 调用**:
```typescript
const summary = await qwenChat([
  { role: "system", content: systemPrompt },
  { role: "user", content: `请基于以下ASR原文生成播客总结：\n${transcript}` }
], {
  maxTokens: 32000,
  temperature: 0.1
});
```

**输出**:
```typescript
{
  summary: string,           // 生成的总结（英文或中文）
  processingTime: number,    // 处理耗时（毫秒）
  estimatedTokens: number   // 估算 token 数
}
```

##### 3.4 两轮生成（段落数 > 40）

**第一轮：生成大纲** ⏱️ ~5-25分钟

**系统提示词**: `getSystemPromptByLanguage(language, basePrompt) + getTwoStageAdditionalPrompt(language)`

**用户提示词**: `getOutlineGenerationPrompt(language, title, primarySource)`

**中文用户提示词**:
```
请基于ASR原文生成一份极其详细的播客报告大纲/框架（不得引入外部信息）：

**播客标题**: {title}

**ASR原文（唯一源，基于此生成大纲）**:
{primarySource}

**大纲生成要求（极其重要！）：**
1. **全面识别所有主题和观点（必须完整）**
   - 仔细阅读ASR原文的**每一个字**，确保不遗漏任何内容
   - 识别**所有**主要主题、次要主题、子主题
   - 提取**每个**主题下的**所有**关键观点、论据、案例、数据、引用、人名、公司名、数字
   - **绝对禁止**遗漏任何重要信息，即使是次要观点也要包含

2. **构建极其详细的框架**
   - 为**每个**主要主题创建一个章节（不要合并主题）
   - 每个章节必须包含：主题名称、所有关键观点、所有重要论据要点、所有相关案例、所有数据、所有人名公司名、所有引用
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

请生成一份极其详细、完整、结构清晰的报告大纲。
```

**英文用户提示词**:
```
Please generate an extremely detailed podcast report outline/framework based on the ASR transcript (do not introduce external information):

**Podcast Title**: {title}

**ASR Transcript (sole source, generate outline based on this)**:
{primarySource}

**Outline Generation Requirements (Extremely Important!):**
1. **Comprehensively identify all themes and viewpoints (must be complete)**
   - Carefully read **every word** of the ASR transcript, ensure no content is missed
   - Identify **all** main themes, secondary themes, sub-themes
   - Extract **all** key viewpoints, arguments, cases, data, citations, names, company names, numbers under **each** theme
   - **Absolutely prohibit** missing any important information, even secondary viewpoints must be included

2. **Build an extremely detailed framework**
   - Create a chapter for **each** main theme (do not merge themes)
   - Each chapter must include: theme name, **all** key viewpoints, **all** important argument points, **all** related cases, **all** data, **all** names, **all** citations
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
- ✅ **Target length: 8,000-12,000 characters** (ensure all content is covered, do not compress)
- ✅ **Do not over-compress**, ensure **all important information** is in the outline
- ✅ **Do not omit secondary viewpoints**, even secondary viewpoints must be included
- ✅ **Do not omit data**, all numbers and statistical information must be included
- ✅ **Do not omit cases**, all specific cases and stories must be included
- ✅ **Do not omit names and company names**, all mentioned entities must be included

Please generate an extremely detailed, complete, and clearly structured report outline.
```

**API 调用**:
```typescript
const outline = await qwenChat([
  { role: "system", content: systemPrompt },
  { role: "user", content: getOutlineGenerationPrompt(language, title, primarySource) }
], {
  maxTokens: 12000,  // 大纲使用 12K token
  temperature: 0.1
});
```

**超时设置**:
```typescript
const isVeryLong = primarySource.length > 100000;
const outlineTimeout = isVeryLong ? 25 * 60 * 1000 : 12 * 60 * 1000; // 25分钟/12分钟
```

**输出**: 大纲文本（8,000-12,000 字符）

**第二轮：生成完整报告** ⏱️ ~10-40分钟

**系统提示词**: 与第一轮相同

**用户提示词**: `getReportGenerationPrompt(language, title, outline, primarySource)`

**中文用户提示词**:
```
请基于以下报告大纲和ASR原文，生成一份完整、详尽的播客总结/报告（不得引入外部信息）：

**播客标题**: {title}

**报告大纲/框架（这是你生成报告的蓝图，必须完全遵循此结构）**:
{outline}

**ASR原文（完整内容，用于填充大纲中的每个部分）**:
{primarySource}

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

请生成一份完整、连贯、专业、详尽且全面的报告。
```

**英文用户提示词**: 对应的英文版本，要求输出英文报告

**API 调用**:
```typescript
const summary = await qwenChat([
  { role: "system", content: systemPrompt },
  { role: "user", content: getReportGenerationPrompt(language, title, outline, primarySource) }
], {
  maxTokens: 32000,  // 报告使用 32K token（最大输出）
  temperature: 0.1
});
```

**超时设置**:
```typescript
const isVeryLong = primarySource.length > 100000;
const reportTimeout = isVeryLong ? 40 * 60 * 1000 : 20 * 60 * 1000; // 40分钟/20分钟
```

**输出**:
```typescript
{
  summary: string,           // 生成的总结（英文或中文）
  outline: string,          // 报告大纲（两轮生成时）
  processingTime: number,    // 处理耗时（毫秒）
  estimatedTokens: number   // 估算 token 数
}
```

**回退机制**:
- 如果大纲生成失败 → 回退到单轮生成
- 如果报告生成失败 → 尝试基于 ASR 原文直接生成（保留大纲）
- 如果所有方式都失败 → 至少返回大纲（如果已生成）

---

#### 步骤 4: 翻译（仅英文播客）⏱️ ~2-10分钟

**函数**: `translateToChineseLarge(text, label)`
- **位置**: `src/server/audio-processor.ts`

**触发条件**:
```typescript
const language = asrData.language || 'unknown';
const isEnglish = language.startsWith('en');

if (isEnglish) {
  // 翻译原文和总结
  translatedTranscript = await translateToChineseLarge(asrData.transcript, 'transcript');
  translatedSummary = await translateToChineseLarge(reportData.summary, 'summary');
}
```

**翻译流程**:

1. **分块处理**
   ```typescript
   const chunkSize = 3500; // 每块 3500 字符
   const chunks = [];
   for (let i = 0; i < text.length; i += chunkSize) {
     chunks.push(text.slice(i, i + chunkSize));
   }
   ```

2. **逐块翻译**
   ```typescript
   for (let i = 0; i < chunks.length; i++) {
     const msg: ChatMessage[] = [
       {
         role: "system",
         content: "你是专业的中英翻译，请将用户提供的英文内容准确、完整地翻译成中文，不要省略信息，不要添加说明。仅输出翻译后的中文内容。"
       },
       {
         role: "user",
         content: `第 ${i + 1}/${chunks.length} 段（${label}）英文内容：\n${chunk}`
       }
     ];
     
     const translatedChunk = await qwenChat(msg, {
       maxTokens: 6000,
       temperature: 0.1
     });
     
     translated.push(translatedChunk.trim());
   }
   ```

3. **合并结果**
   ```typescript
   return translated.join("\n");
   ```

**输出**:
- `translatedTranscript`: 中文翻译的 ASR 原文
- `translatedSummary`: 中文翻译的总结

**缓存写入**:
```typescript
await setCachedAudio(meta.audioUrl, {
  summary: reportData?.summary,              // 英文原文总结
  translatedTranscript: translatedTranscript, // 中文翻译原文
  translatedSummary: translatedSummary       // 中文翻译总结
});
```

---

#### 步骤 5: 保存到数据库 ⏱️ ~1-3秒

**位置**: `src/server/audio-processor.ts`

**数据准备**:
```typescript
const podcastData = {
  title: meta.title,
  sourceUrl: url,
  audioUrl: meta.audioUrl,
  description: meta.description,
  publishedAt: meta.publishedAt ? new Date(meta.publishedAt) : null,
  duration: asrData.duration,
  status: 'READY',
  
  // 原文（英文播客为英文，中文播客为中文）
  originalTranscript: asrData.transcript,
  transcript: asrData.transcript,  // 英文原文（如果是英文播客）
  summary: reportData?.summary,     // 英文原文总结（如果是英文播客）
  
  // 翻译（仅英文播客有值）
  translatedTranscript: translatedTranscript || null,
  translatedSummary: translatedSummary || null,
  
  showAuthor: meta.author,
  processingStartedAt: new Date(startTime),
  processingCompletedAt: new Date(),
  createdById: userId,
  topicId: autoTaggedTopicId,
  reportOutline: reportData?.outline || null
};
```

**数据库写入**:
```typescript
// 使用 withRetry 包装，处理数据库连接问题
const podcast = await withRetry(async () => {
  return await db.podcast.create({
    data: podcastData
  });
}, 3, 1000); // 最多重试 3 次，每次间隔 1 秒
```

**任务状态更新**:
```typescript
await db.taskQueue.update({
  where: { id: taskId },
  data: {
    status: 'READY',
    completedAt: new Date(),
    result: { podcastId: podcast.id }
  }
});
```

**输出**: 播客记录已保存到数据库，状态为 `READY`

---

## 5. 前端轮询与展示

### 5.1 轮询任务状态
**位置**: `src/app/home/page.tsx` - `pollTaskStatus`

**轮询配置**:
```typescript
const POLL_INTERVAL_MS = 10000; // 每 10 秒轮询一次
const MAX_POLL_DURATION = 60 * 60 * 1000; // 最多轮询 1 小时
```

**轮询流程**:
```typescript
const pollInterval = setInterval(async () => {
  // 1. 调用任务状态 API
  const res = await fetch(`/api/task-status?taskId=${taskId}`, {
    signal: AbortSignal.timeout(30000) // 30秒超时
  });
  
  // 2. 解析响应
  const taskStatus = await res.json();
  
  // 3. 根据状态处理
  if (taskStatus.status === 'READY') {
    // 处理成功，跳转到详情页
    clearInterval(pollInterval);
    window.location.href = `/podcast/${taskStatus.result.podcastId}`;
  } else if (taskStatus.status === 'FAILED') {
    // 处理失败，显示错误
    clearInterval(pollInterval);
    showError(taskStatus.error);
  } else if (taskStatus.status === 'RUNNING') {
    // 仍在处理中，更新进度
    updateProgress(taskStatus.metrics);
  }
}, POLL_INTERVAL_MS);
```

**任务状态 API**
**位置**: `src/app/api/task-status/route.ts`

**响应格式**:
```typescript
{
  status: 'PENDING' | 'RUNNING' | 'READY' | 'FAILED',
  metrics: {
    audioDuration: number,
    asrSegmentsCount: number,
    processingSteps: {
      asr: { status: 'running' | 'completed', duration: number },
      report: { status: 'running' | 'completed', duration: number }
    }
  },
  result: {
    podcastId: string  // READY 状态时返回
  },
  error: string       // FAILED 状态时返回
}
```

**失败处理**:
- 连续失败 5 次 → 标记为失败
- FAILED 状态轮询 8 次或超过 2 分钟 → 标记为失败
- 超时错误 → 给 3 倍重试机会（15 次）

---

## 6. 详情页数据获取

### 6.1 前端请求
**位置**: `src/app/podcast/[id]/page.tsx`

**请求流程**:
```typescript
const loadPodcast = async () => {
  const res = await fetch(`/api/public/podcast?id=${id}&t=${Date.now()}`);
  const data = await res.json();
  setPodcast(data);
  
  // 如果有翻译字段，默认显示英文原文
  if (data.translatedSummary || data.translatedTranscript) {
    setIsEnglishOriginal(true);
  }
};
```

### 6.2 API 处理
**位置**: `src/app/api/public/podcast/route.ts`

**处理流程**:

1. **用户识别**
   ```typescript
   // 检查是否是 MuleRun 用户
   const isMulerunRequest = 
     referer.includes('/mulerun/') || 
     searchParams.get('_mulerun') === 'true';
   
   // 检查是否已登录
   const user = await getSessionUser().catch(() => null);
   
   // Visitor 限制检查（仅未登录且非 MuleRun 用户）
   if (!user && !isMulerunRequest) {
     visitorUsage = await getVisitorUsage(clientIp, userAgent);
     visitorLimitExceeded = !visitorUsage.allowed;
   }
   ```

2. **数据库查询**
   ```typescript
   // 优先查询 Podcast 表
   let podcast = await prisma.podcast.findFirst({
     where: { id },
     select: {
       id: true,
       title: true,
       showAuthor: true,
       publishedAt: true,
       audioUrl: true,
       sourceUrl: true,
       summary: true,
       translatedSummary: true,      // 中文翻译总结
       originalTranscript: true,
       translatedTranscript: true,  // 中文翻译原文
       reportOutline: true,
       topic: { select: { name: true } },
       updatedAt: true
     }
   });
   
   // 如果 Podcast 表未找到，查询 AudioCache 表
   if (!podcast) {
     const audioCache = await prisma.audioCache.findFirst({
       where: { id },
       select: { /* ... */ }
     });
   }
   ```

3. **内容限制**（仅 Visitor 且权限已用完）
   ```typescript
   if (!user && !isMulerunRequest && visitorLimitExceeded) {
     // 截取摘要的前10行
     if (summaryToReturn) {
       const summaryLines = summaryToReturn.split('\n');
       summaryToReturn = summaryLines.slice(0, 10).join('\n');
     }
     
     // 截取转录稿的前10行
     if (transcriptToReturn) {
       const transcriptLines = transcriptToReturn.split('\n');
       transcriptToReturn = transcriptLines.slice(0, 10).join('\n');
     }
   }
   ```

4. **返回响应**
   ```typescript
   return NextResponse.json({
     id: podcast.id,
     title: podcast.title,
     author: podcast.showAuthor,
     publishedAt: podcast.publishedAt,
     audioUrl: podcast.audioUrl,
     originalUrl: podcast.sourceUrl,
     summary: summaryToReturn,
     translatedSummary: podcast.translatedSummary,  // 中文翻译总结
     originalTranscript: transcriptToReturn,
     translatedTranscript: podcast.translatedTranscript,  // 中文翻译原文
     reportOutline: podcast.reportOutline,
     topic: podcast.topic,
     likeCount: likeCount,
     isLimited: visitorLimitExceeded,
     visitorLimitExceeded: visitorLimitExceeded
   });
   ```

### 6.3 前端展示
**位置**: `src/app/podcast/[id]/page.tsx`

**显示逻辑**:
```typescript
// 默认显示英文原文（如果有翻译）
const [isEnglishOriginal, setIsEnglishOriginal] = useState(false);

useEffect(() => {
  if (podcast.translatedSummary || podcast.translatedTranscript) {
    setIsEnglishOriginal(true); // 默认显示英文原文
  }
}, [podcast]);

// 根据状态显示内容
<SummaryDisplay 
  summary={
    isEnglishOriginal && podcast.translatedSummary
      ? podcast.summary  // 显示英文原文
      : (podcast.translatedSummary || podcast.summary)  // 显示中文翻译或原文
  }
/>

// 翻译切换按钮（仅当有翻译时显示）
{podcast.translatedSummary && (
  <button onClick={() => setIsEnglishOriginal(!isEnglishOriginal)}>
    {isEnglishOriginal ? 'EN' : '中'}
  </button>
)}
```

---

## 📊 完整流程时间线

### 示例：66分钟英文播客

| 步骤 | 操作 | 耗时 | 说明 |
|------|------|------|------|
| **1** | 用户提交链接 | ~1秒 | 前端验证 + API 调用 |
| **2** | 创建任务 | ~0.5秒 | 任务队列创建 |
| **3** | 解析元数据 | ~2秒 | 解析 Apple Podcasts 页面 |
| **4** | ASR 转写 | ~3分钟 | 34个片段，并发转写 |
| **5** | 报告生成（两轮） | ~30分钟 | 大纲生成（12分钟）+ 报告生成（18分钟） |
| **6** | 翻译 | ~5分钟 | 原文翻译（3分钟）+ 总结翻译（2分钟） |
| **7** | 保存数据库 | ~1秒 | 写入 Podcast 表 |
| **8** | 前端轮询 | ~10秒/次 | 每 10 秒轮询一次，直到 READY |
| **9** | 详情页展示 | ~0.5秒 | 获取数据并渲染 |

**总耗时**: 约 **40-45 分钟**（大部分时间在报告生成和翻译）

---

## 🔑 关键 API 和函数

### API 端点

1. **`POST /api/process-audio-async`**
   - 提交播客处理任务
   - 返回 `taskId`

2. **`GET /api/task-status?taskId=xxx`**
   - 查询任务状态
   - 返回任务状态、进度、结果

3. **`GET /api/public/podcast?id=xxx`**
   - 获取播客详情
   - 支持 Visitor 限制、MuleRun 用户识别

### 核心函数

1. **`parseUniversalPodcast(url)`**
   - 解析播客元数据
   - 支持多平台（Apple Podcasts、小宇宙等）

2. **`transcribeWithAliyunASR(audioUrl, language)`**
   - ASR 转写
   - 支持自动语言检测

3. **`generateReportWhole(input, fromChunked)`**
   - 生成播客总结
   - 支持单轮/两轮生成
   - 根据语言选择提示词

4. **`translateToChineseLarge(text, label)`**
   - 翻译英文内容为中文
   - 分块处理，避免超长上下文

5. **`processAudioInternal(url, userId, taskId)`**
   - 主处理函数
   - 协调所有处理步骤

---

## 🎯 语言处理逻辑总结

### 中文播客
1. ASR 检测到 `language = "zh"`
2. 使用中文提示词生成中文总结
3. `summary` = 中文总结
4. `translatedSummary` = `null`
5. 前端默认显示中文总结

### 英文播客
1. ASR 检测到 `language = "en"`
2. 使用英文提示词生成英文总结
3. `summary` = 英文总结（原文）
4. 异步翻译 → `translatedSummary` = 中文翻译
5. 前端默认显示英文总结，可切换到中文翻译

---

## 📝 提示词总结

### 英文播客提示词
- **基础提示词**: 英文版本，要求输出英文总结
- **两轮生成追加**: 英文版本的详细要求
- **大纲生成**: 英文版本的大纲生成提示词
- **报告生成**: 英文版本的报告生成提示词

### 中文播客提示词
- **基础提示词**: 中文版本，要求输出中文总结
- **两轮生成追加**: 中文版本的详细要求（包含引用逻辑、写作风格等）
- **大纲生成**: 中文版本的大纲生成提示词
- **报告生成**: 中文版本的报告生成提示词

### 翻译提示词
- **系统提示词**: "你是专业的中英翻译，请将用户提供的英文内容准确、完整地翻译成中文，不要省略信息，不要添加说明。仅输出翻译后的中文内容。"
- **用户提示词**: "第 {i+1}/{chunks.length} 段（{label}）英文内容：\n{chunk}"

---

## 🔄 数据流转

```
用户输入 URL
    ↓
前端提交 → /api/process-audio-async
    ↓
任务队列 → 创建 PENDING 任务
    ↓
后台处理 → processAudioInternal
    ↓
步骤1: parseUniversalPodcast → 元数据
    ↓
步骤2: transcribeWithAliyunASR → ASR 原文 + 语言检测
    ↓
步骤3: generateReportWhole → 总结（英文/中文）
    ↓
步骤4: translateToChineseLarge → 翻译（仅英文）
    ↓
步骤5: db.podcast.create → 保存到数据库
    ↓
任务状态更新 → READY
    ↓
前端轮询 → 检测到 READY
    ↓
跳转详情页 → /podcast/[id]
    ↓
/api/public/podcast → 获取播客数据
    ↓
前端渲染 → 显示播客详情
```

---

## 🎨 前端展示逻辑

### 英文播客详情页
1. **默认显示**: 英文总结（`summary`）
2. **翻译按钮**: 显示 "EN / 中" 切换按钮
3. **切换逻辑**: 
   - `isEnglishOriginal = true` → 显示英文原文
   - `isEnglishOriginal = false` → 显示中文翻译（`translatedSummary`）

### 中文播客详情页
1. **默认显示**: 中文总结（`summary`）
2. **翻译按钮**: 不显示（因为没有翻译字段）

---

这就是从播客上传到用户看到详情页面的完整流程！每个环节都有详细的日志记录，方便排查问题。

