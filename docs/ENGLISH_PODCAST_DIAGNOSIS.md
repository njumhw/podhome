# 英文播客问题诊断指南

## 问题描述

英文播客处理后，详情页仍然显示中文内容，而不是英文。

**测试案例**：
- 输入：https://podcasts.apple.com/cn/podcast/big-ideas-2026-voice-agents-and-high-stakes-trust/id842818711?i=1000742582027
- 输出：https://podcasttoinsight.top/podcast/cmjk8ylaj002k5ye3vkmbw5fr
- 问题：详情页显示中文总结，而不是英文总结

## 关键代码流程

### 1. ASR 调用链

```
processAudioInternal
  → transcribeWithAliyunASR(meta.audioUrl)  // 默认 language = "auto"
    → transcribeAudioWithSegmentation(audioUrl, "auto")
      → qwenTranscribeFromUrl(segmentUrl, undefined)  // ⚠️ "auto" 被转换为 undefined
        → DashScope ASR API (不设置 language 参数，使用默认)
```

**关键代码位置**：
- `src/server/asr-segmented.ts:621`: `language === "auto" ? undefined : language`
- `src/clients/qwen-asr.ts:83`: `if (language && language !== "auto") { payload.parameters.language = language; }`

**潜在问题**：
- 当 `language === "auto"` 时，传递 `undefined` 给 ASR
- ASR 可能使用默认语言（可能是中文），而不是自动检测

### 2. 语言检测

```typescript
// src/server/audio-processor.ts:201
const detectedLang = detectLanguage(asrResult);

// src/server/audio-processor.ts:16
function detectLanguage(asrResult: any): string {
  const lang = (asrResult?.language || asrResult?.lang || asrResult?.languageCode || "").toLowerCase();
  if (lang.startsWith("en")) return "en";
  if (lang.startsWith("zh")) return "zh";
  return lang || "unknown";
}
```

**潜在问题**：
- 如果 ASR 没有返回 `language` 字段，`detectLanguage` 返回 `"unknown"`
- 如果 ASR 返回的语言格式不是 `"en"` 开头（如 `"English"`、`"eng"`），无法识别

### 3. 报告生成

```typescript
// src/server/audio-processor.ts:278
const reportBody = {
  language: asrData.language || undefined
};

// src/clients/report-generator.ts:641
let systemPrompt = getSystemPromptByLanguage(language, basePrompt);

// src/clients/report-generator.ts:532
function getSystemPromptByLanguage(language?: string, basePrompt?: string): string {
  const isEnglish = language?.startsWith('en');
  if (isEnglish) {
    return `You are a former McKinsey Global Partner...`; // 英文提示词
  } else {
    return basePrompt || `你是前麦肯锡全球合伙人...`; // 中文提示词
  }
}
```

**潜在问题**：
- 如果 `language` 不是 `"en"` 开头，会使用中文提示词
- 数据库中的 `basePrompt` 可能要求输出中文，覆盖了语言判断

## 诊断步骤（在服务器上执行）

### 步骤 1: 查看语言检测日志

```bash
# 查看最近处理的播客日志中的语言检测信息
pm2 logs podroom --out --lines 1000 | grep -E "语言检测|asrResult\.language|ASR数据.*语言|报告生成.*语言|getSystemPromptByLanguage" | tail -50
```

**关键日志**：
- `[语言检测] asrResult.language=...` - ASR 返回的原始语言值
- `[ASR数据] 语言字段: ...` - 检测后的语言值
- `[报告生成] 传递语言参数: language=...` - 传递给报告生成的语言
- `[getSystemPromptByLanguage] 语言检测: language=..., isEnglish=...` - 提示词选择逻辑

### 步骤 2: 查看 ASR 转写日志

```bash
# 查看 ASR 转写过程中的语言信息
pm2 logs podroom --out --lines 1000 | grep -E "检测到语言|language.*en|language.*zh|转写成功.*语言" | tail -30
```

**关键日志**：
- `片段 X/Y 转写成功, 语言: ...` - 每个片段检测到的语言
- `分段ASR转写完成: ... 检测到语言: ...` - 最终检测到的语言

### 步骤 3: 查看特定播客的处理日志

```bash
# 查找特定播客 ID 的处理日志
pm2 logs podroom --out --lines 2000 | grep -A 5 -B 5 "cmjk8ylaj002k5ye3vkmbw5fr" | grep -E "语言|language|en|zh"
```

## 可能的问题原因

### 原因 1: ASR 没有返回语言信息

**症状**：
- 日志中 `asrResult.language` 为 `undefined` 或 `null`
- `detectLanguage` 返回 `"unknown"`
- `getSystemPromptByLanguage` 使用中文提示词

**验证**：
查看日志中的 `[语言检测] asrResult.language=...`

### 原因 2: ASR 返回的语言格式不正确

**症状**：
- ASR 返回的语言可能是 `"English"` 而不是 `"en"`
- 或者返回 `"eng"`、`"EN"` 等格式
- `detectLanguage` 无法正确识别（只检查 `startsWith("en")`）

**验证**：
查看日志中的 `asrResult.language` 实际值

### 原因 3: ASR 使用默认语言（中文）

**症状**：
- 当 `language === "auto"` 时，传递 `undefined` 给 ASR
- ASR 可能使用默认语言（中文）而不是自动检测
- 即使音频是英文，也按中文转写

**验证**：
查看 ASR 转写结果，如果英文播客被转写为中文文本，说明 ASR 使用了中文

### 原因 4: 数据库提示词覆盖语言判断

**症状**：
- `getSystemPromptByLanguage` 正确选择了英文提示词
- 但数据库中的 `basePrompt` 要求输出中文
- 最终使用的提示词仍然是中文

**验证**：
查看日志中的 `[getSystemPromptByLanguage]` 输出，确认是否使用了英文提示词

## 修复方案（待确认问题后实施）

### 方案 1: 修复 ASR 语言参数传递

**问题**：当 `language === "auto"` 时，传递 `undefined` 可能导致 ASR 使用默认语言

**修复**：
```typescript
// src/server/asr-segmented.ts:621
// 修改前：
const r = await qwenTranscribeFromUrl(it.url, language === "auto" ? undefined : language);

// 修改后：
// 如果 language === "auto"，不传递 language 参数，让 ASR 自动检测
// 但需要确保 ASR 能正确返回语言信息
const r = await qwenTranscribeFromUrl(it.url, language === "auto" ? undefined : language);
// 实际上，如果 ASR 支持自动检测，不设置 language 参数应该可以
// 问题可能是 ASR 没有返回语言信息，或者返回的格式不正确
```

### 方案 2: 增强语言检测逻辑

**问题**：`detectLanguage` 只检查 `startsWith("en")`，可能无法识别其他格式

**修复**：
```typescript
// src/server/audio-processor.ts:16
function detectLanguage(asrResult: any): string {
  const lang = (asrResult?.language || asrResult?.lang || asrResult?.languageCode || "").toLowerCase();
  
  // 更宽松的英文检测
  if (lang.includes('en') || lang === 'english') return "en";
  if (lang.includes('zh') || lang === 'chinese' || lang === '中文') return "zh";
  
  return lang || "unknown";
}
```

### 方案 3: 强制使用英文提示词（如果检测到英文）

**问题**：数据库提示词可能覆盖语言判断

**修复**：
```typescript
// src/clients/report-generator.ts:532
function getSystemPromptByLanguage(language?: string, basePrompt?: string): string {
  // 更宽松的英文检测
  const isEnglish = language?.startsWith('en') || 
                   language?.includes('en') || 
                   language?.toLowerCase() === 'english';
  
  console.log(`[getSystemPromptByLanguage] 语言检测: language=${language}, isEnglish=${isEnglish}`);
  
  if (isEnglish) {
    console.log(`[getSystemPromptByLanguage] 使用英文提示词（要求输出英文总结）`);
    // 强制使用英文提示词，忽略数据库提示词
    return `You are a former McKinsey Global Partner...`;
  }
  // ...
}
```

### 方案 4: 添加更多调试日志

**目的**：确认语言信息在各个环节的传递情况

**添加位置**：
- ASR 返回后：记录原始语言值
- 语言检测后：记录检测结果
- 报告生成前：记录传递的语言参数
- 提示词选择后：记录使用的提示词类型

## 下一步

1. **先执行诊断步骤**，查看日志确认问题
2. **根据日志结果**，确定具体的修复方案
3. **实施修复**，并再次测试

**请先执行诊断步骤，然后告诉我日志结果，我会根据结果确定具体的修复方案。**

