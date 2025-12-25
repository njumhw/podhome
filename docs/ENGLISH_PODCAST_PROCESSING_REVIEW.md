# 英文播客处理流程检查清单

## 📋 处理流程概述

### 方案设计
- **英文播客**：并行生成英文总结和中文总结
  - `summary` = 英文总结（主总结）
  - `translatedSummary` = 中文总结（翻译总结）
- **中文播客**：只生成中文总结
  - `summary` = 中文总结（主总结）
  - `translatedSummary` = null

## ✅ 代码检查清单

### 1. 后端处理逻辑 (`src/server/audio-processor.ts`)

#### ✅ 语言检测
- [x] 第522行：`isEnglish` 检测逻辑（支持 "en", "en-US", "english"）
- [x] 第523行：日志记录语言检测结果

#### ✅ 英文总结生成
- [x] 第367行：传递 `language: asrData.language` 给 `generateReportWhole`
- [x] 第403行：调用 `generateReportWhole(reportBody)`，会根据language选择英文提示词
- [x] 第533-536行：如果 `reportData?.summary` 存在，保存到 `englishSummary`

#### ✅ 中文总结并行生成
- [x] 第540-565行：并行生成中文总结和翻译转写
- [x] 第550行：传递 `language: 'zh'` 强制使用中文提示词
- [x] 第552行：调用 `generateReportWhole(chineseReportBody)` 生成中文总结
- [x] 第567行：保存到 `chineseSummary`

#### ✅ 字段映射
- [x] 第653行：`summaryToStore = isEnglish ? (englishSummary || null) : (chineseSummary || null)`
- [x] 第654行：`translatedSummaryToStore = isEnglish ? (chineseSummary || null) : null`
- [x] 第666行：`summary: summaryToStore` - 英文播客=英文总结，中文播客=中文总结
- [x] 第668行：`translatedSummary: translatedSummaryToStore` - 英文播客=中文总结，中文播客=null

#### ✅ 缓存更新
- [x] 第590行：`summary: isEnglish ? englishSummary || undefined : chineseSummary || undefined`
- [x] 第592行：`translatedSummary: isEnglish ? chineseSummary || undefined : undefined`

#### ✅ MuleRun用户保存逻辑
- [x] 第933行：`summaryToStore = isEnglish ? (englishSummary || null) : (chineseSummary || null)`
- [x] 第934行：`translatedSummaryToStore = isEnglish ? (chineseSummary || null) : null`
- [x] 第947行：`summary: summaryToStore`
- [x] 第948行：`translatedSummary: translatedSummaryToStore`

### 2. 提示词生成 (`src/clients/report-generator.ts`)

#### ✅ 英文提示词
- [x] 第532-612行：`getSystemPromptByLanguage` 函数
- [x] 第539行：英文检测逻辑
- [x] 第543-612行：完整的英文提示词（基于中文提示词翻译，删除"输出为中文"的要求）
- [x] 包含所有必要的要求：输出语言、长度、风格、结构等

#### ✅ 中文提示词
- [x] 第614-637行：中文提示词逻辑
- [x] 第620-633行：多语言支持说明（如果数据库提示词中没有）

### 3. API返回 (`src/app/api/public/podcast/route.ts`)

#### ✅ 数据库查询
- [x] 第112行：`translatedSummary: true` - 查询字段包含
- [x] 第140行：兼容查询也包含 `translatedSummary`
- [x] 第208行：AudioCache查询也包含 `translatedSummary`

#### ✅ 响应数据
- [x] 第303行：`translatedSummary: podcast.translatedSummary` - 返回翻译总结
- [x] 第302行：`summary: summaryToReturn` - 返回主总结

### 4. 前端显示逻辑 (`src/app/podcast/[id]/page.tsx`)

#### ✅ 状态初始化
- [x] 第94行：`isEnglishOriginal` 默认值为 `true`
- [x] 第139-145行：根据 `translatedSummary` 或 `translatedTranscript` 设置默认显示语言

#### ✅ 切换按钮
- [x] 第817行：只在有 `translatedSummary` 时显示切换按钮
- [x] 第819行：点击切换 `isEnglishOriginal` 状态
- [x] 第1076行：ASR区域也有切换按钮（如果有 `translatedTranscript`）

#### ✅ 内容显示
- [x] 第887-889行：根据 `isEnglishOriginal` 显示对应的总结
  - `isEnglishOriginal && podcast.translatedSummary` → 显示 `podcast.summary`（英文）
  - 否则 → 显示 `podcast.translatedSummary || podcast.summary`（中文或原文）

#### ✅ ASR显示
- [x] 第1123-1125行：根据 `isEnglishOriginal` 显示对应的转写
  - `isEnglishOriginal && podcast.translatedTranscript` → 显示 `podcast.originalTranscript`（英文）
  - 否则 → 显示 `podcast.translatedTranscript || podcast.originalTranscript`（中文或原文）

## 🔍 潜在问题检查

### ⚠️ 需要确认的点

1. **英文总结生成时机**
   - 第403行：`generateReportWhole(reportBody)` 会根据 `language: asrData.language` 选择提示词
   - 如果 `asrData.language` 是 "en"，会使用英文提示词生成英文总结
   - ✅ 逻辑正确

2. **并行生成是否真的并行**
   - 第540行：`Promise.all` 确保并行执行
   - ✅ 逻辑正确

3. **字段映射是否一致**
   - 登录用户：第653-668行
   - MuleRun用户：第933-948行
   - 缓存：第590-592行
   - ✅ 逻辑一致

4. **前端显示逻辑**
   - 第887-889行：显示逻辑正确
   - ✅ 逻辑正确

## 📝 总结

### ✅ 已完成的修改

1. ✅ **后端处理逻辑**：英文播客并行生成英文和中文总结
2. ✅ **提示词生成**：完整的英文提示词（基于中文提示词翻译）
3. ✅ **字段映射**：正确的字段映射逻辑（summary=主总结，translatedSummary=翻译总结）
4. ✅ **API返回**：正确返回 `summary` 和 `translatedSummary`
5. ✅ **前端显示**：默认显示英文，可切换中文

### ⚠️ 需要注意的点

1. **英文总结生成**：依赖于 `reportData.summary`，如果生成失败，`englishSummary` 可能为 null
2. **中文总结生成**：如果并行生成失败，`chineseSummary` 可能为 null
3. **前端显示**：如果 `translatedSummary` 为 null，不会显示切换按钮，只显示 `summary`

### 🎯 预期行为

**英文播客**：
- `summary` = 英文总结（主总结）
- `translatedSummary` = 中文总结（翻译总结）
- 前端默认显示英文总结，可切换中文总结

**中文播客**：
- `summary` = 中文总结（主总结）
- `translatedSummary` = null
- 前端只显示中文总结，无切换按钮

## 🚀 测试建议

1. 上传一个英文播客，检查：
   - 数据库中 `summary` 是否为英文
   - 数据库中 `translatedSummary` 是否为中文
   - 前端是否默认显示英文总结
   - 切换按钮是否正常工作

2. 上传一个中文播客，检查：
   - 数据库中 `summary` 是否为中文
   - 数据库中 `translatedSummary` 是否为 null
   - 前端是否只显示中文总结
   - 无切换按钮

