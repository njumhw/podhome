# 英文播客处理问题分析

## 问题描述

用户上传英文播客后，生成的详情页仍然显示中文内容，而不是英文。

**测试链接**：
- 输入：https://podcasts.apple.com/cn/podcast/big-ideas-2026-voice-agents-and-high-stakes-trust/id842818711?i=1000742582027
- 输出：https://podcasttoinsight.top/podcast/cmjk8ylaj002k5ye3vkmbw5fr
- 问题：详情页显示中文总结，而不是英文总结

## 处理流程分析

### 1. ASR 转写阶段

**调用链**：
```
processAudioInternal
  → transcribeWithAliyunASR(meta.audioUrl)  // 默认 language = "auto"
    → transcribeAudioWithSegmentation(audioUrl, language)  // 传递 "auto"
      → qwenTranscribeFromUrl(audioUrl, language)  // 传递 "auto"
```

**关键代码**：
```typescript
// src/server/audio-processor.ts:175
asrResult = await transcribeWithAliyunASR(meta.audioUrl);
// 没有传递 language 参数，使用默认值 "auto"

// src/server/asr.ts:57
export async function transcribeWithAliyunASR(audioUrl: string, language: string = "auto"): Promise<ASRResult> {
  const result = await transcribeAudioWithSegmentation(audioUrl, language);
  // ...
  return {
    // ...
    language: detectedLanguage // 从 ASR 返回的语言信息
  };
}

// src/server/asr-segmented.ts:23
export async function transcribeAudioWithSegmentation(
  audioUrl: string,
  language: string = "zh"  // ⚠️ 默认值是 "zh"，但实际调用时传递的是 "auto"
): Promise<{
  // ...
  language?: string;
}> {
  // ...
  // 在调用 qwenTranscribeFromUrl 时传递 language
  const result = await qwenTranscribeFromUrl(segmentUrl, language);
  // ...
  return {
    // ...
    language: result.language // 从 ASR 返回的语言信息
  };
}

// src/clients/qwen-asr.ts:29
export async function qwenTranscribeFromUrl(audioUrl: string, language?: string): Promise<QwenAsrResp> {
  // ...
  if (language && language !== "auto") {
    payload.parameters.language = language;
  }
  // 如果 language === "auto"，不设置 language 参数，让 ASR 自动检测
  // ...
  const languageDetected = out?.language || statusData?.language;
  return { text, language: languageDetected, segments: segmentsArray };
}
```

**问题点 1**：`transcribeAudioWithSegmentation` 的默认参数是 `"zh"`，但实际调用时传递的是 `"auto"`，所以应该没问题。

**问题点 2**：ASR 应该能自动检测语言并返回 `language` 字段。需要确认 ASR 是否真的返回了 `"en"`。

### 2. 语言检测阶段

**关键代码**：
```typescript
// src/server/audio-processor.ts:201
const detectedLang = detectLanguage(asrResult);
console.log(`[语言检测] asrResult.language=${asrResult.language}, detectLanguage结果=${detectedLang}`);

// src/server/audio-processor.ts:16
function detectLanguage(asrResult: any): string {
  const lang = (asrResult?.language || asrResult?.lang || asrResult?.languageCode || "").toLowerCase();
  if (lang.startsWith("en")) return "en";
  if (lang.startsWith("zh")) return "zh";
  return lang || "unknown";
}
```

**问题点 3**：如果 ASR 返回的语言字段不是 `"en"` 或 `"en-US"` 等以 `"en"` 开头的值，`detectLanguage` 可能无法正确识别。

### 3. 报告生成阶段

**关键代码**：
```typescript
// src/server/audio-processor.ts:278
const reportBody = {
  // ...
  language: asrData.language || undefined // 传递ASR检测到的语言
};
console.log(`[报告生成] 传递语言参数: language=${reportBody.language}, transcript长度=${reportBody.transcript.length}`);

// src/clients/report-generator.ts:641
let systemPrompt = getSystemPromptByLanguage(language, basePrompt);

// src/clients/report-generator.ts:532
function getSystemPromptByLanguage(language?: string, basePrompt?: string): string {
  const isEnglish = language?.startsWith('en');
  console.log(`[getSystemPromptByLanguage] 语言检测: language=${language}, isEnglish=${isEnglish}`);
  
  if (isEnglish) {
    console.log(`[getSystemPromptByLanguage] 使用英文提示词（要求输出英文总结）`);
    // 返回英文提示词
    return `You are a former McKinsey Global Partner...`;
  } else {
    // 返回中文提示词
    return basePrompt || `你是前麦肯锡全球合伙人...`;
  }
}
```

**问题点 4**：如果 `language` 参数没有正确传递，或者不是 `"en"` 开头，`getSystemPromptByLanguage` 会使用中文提示词。

### 4. 数据保存阶段

**关键代码**：
```typescript
// src/server/audio-processor.ts:431-453
const language = asrData.language || 'unknown';
const isEnglish = language.startsWith('en');
console.log(`[语言检测] asrData.language=${asrData.language}, language=${language}, isEnglish=${isEnglish}`);

if (isEnglish) {
  // 保存英文原文到主字段
  // 翻译为中文保存到 translatedTranscript 和 translatedSummary
} else {
  // 保存中文原文到主字段
  // translatedTranscript 和 translatedSummary 为 null
}
```

**问题点 5**：如果 `isEnglish` 为 `false`，英文内容会被错误地保存到主字段，而不是保存英文原文。

## 可能的问题原因

### 假设 1: ASR 没有返回语言信息

**症状**：
- `asrResult.language` 为 `undefined` 或 `null`
- `detectLanguage` 返回 `"unknown"`
- `getSystemPromptByLanguage` 使用中文提示词

**验证方法**：
查看日志中的 `[语言检测]` 和 `[getSystemPromptByLanguage]` 输出。

### 假设 2: ASR 返回的语言格式不正确

**症状**：
- ASR 返回的语言可能是 `"English"` 而不是 `"en"`
- 或者返回的是其他格式，如 `"eng"`、`"EN"` 等
- `detectLanguage` 无法正确识别

**验证方法**：
查看日志中的 `asrResult.language` 实际值。

### 假设 3: 语言信息在传递过程中丢失

**症状**：
- ASR 返回了正确的语言信息
- 但在传递到 `generateReportWhole` 时丢失
- `getSystemPromptByLanguage` 收到 `undefined`

**验证方法**：
查看日志中的 `[报告生成] 传递语言参数` 输出。

### 假设 4: 数据库提示词覆盖了语言判断

**症状**：
- `getSystemPromptByLanguage` 正确选择了英文提示词
- 但数据库中的 `basePrompt` 要求输出中文
- 最终使用的提示词仍然是中文

**验证方法**：
查看日志中的 `[getSystemPromptByLanguage]` 输出，确认是否使用了英文提示词。

## 诊断步骤

### 步骤 1: 查看处理日志

在服务器上执行：
```bash
# 查看最近处理的播客日志
pm2 logs podroom --out --lines 500 | grep -E "语言检测|getSystemPromptByLanguage|报告生成.*语言|asrResult\.language" | tail -50
```

**关键日志**：
- `[语言检测] asrResult.language=...`
- `[ASR数据] 语言字段: ...`
- `[报告生成] 传递语言参数: language=...`
- `[getSystemPromptByLanguage] 语言检测: language=..., isEnglish=...`

### 步骤 2: 检查 ASR 返回的语言格式

查看 ASR 实际返回的语言值：
```bash
pm2 logs podroom --out --lines 500 | grep -E "检测到语言|language.*en|language.*zh" | tail -20
```

### 步骤 3: 检查数据库中的提示词

如果使用了数据库提示词，检查是否要求输出中文：
```sql
SELECT * FROM Prompt WHERE key = 'report_generation_whole';
```

## 修复方案（待确认问题后实施）

### 方案 1: 增强语言检测逻辑

如果 ASR 返回的语言格式不标准，增强 `detectLanguage` 函数：

```typescript
function detectLanguage(asrResult: any): string {
  const lang = (asrResult?.language || asrResult?.lang || asrResult?.languageCode || "").toLowerCase();
  
  // 更宽松的英文检测
  if (lang.includes('en') || lang === 'english') return "en";
  if (lang.includes('zh') || lang === 'chinese' || lang === '中文') return "zh";
  
  return lang || "unknown";
}
```

### 方案 2: 强制使用英文提示词（如果检测到英文）

在 `getSystemPromptByLanguage` 中，如果检测到英文，强制使用英文提示词，忽略数据库提示词：

```typescript
function getSystemPromptByLanguage(language?: string, basePrompt?: string): string {
  const isEnglish = language?.startsWith('en') || language?.includes('en') || language === 'english';
  
  if (isEnglish) {
    // 强制使用英文提示词，忽略数据库提示词
    return `You are a former McKinsey Global Partner...`;
  }
  // ...
}
```

### 方案 3: 添加日志验证

在关键位置添加更详细的日志，确认语言信息是否正确传递：

```typescript
console.log(`[DEBUG] ASR原始结果:`, JSON.stringify({
  language: asrResult.language,
  lang: asrResult.lang,
  languageCode: asrResult.languageCode
}));
```

## 下一步

1. **先查看日志**，确认问题出在哪个环节
2. **根据日志结果**，确定具体的修复方案
3. **实施修复**，并再次测试

