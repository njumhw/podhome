# 📝 Git提交指南

## 📊 当前状态

- **已修改但未提交**: 31个文件
- **未跟踪的新文件**: 51个文件
- **Git远程仓库**: `https://github.com/njumhw/podhome.git`

---

## ✅ 需要提交的重要文件

### 1. 核心代码修改（31个已修改文件）

这些文件包含了所有重要的功能改进和bug修复：

**配置文件**:
- `env.example` - 环境变量示例更新
- `prisma/schema.prisma` - 数据库schema更新

**源代码文件** (src/):
- API路由文件（`src/app/api/`）
- 前端页面（`src/app/home/page.tsx`, `src/app/podcast/[id]/page.tsx`等）
- 服务器端逻辑（`src/server/audio-processor.ts`, `src/server/task-queue.ts`等）
- 客户端逻辑（`src/clients/report-generator.ts`等）
- 组件文件（`src/components/`）

### 2. 新增的重要文件

**核心功能文件**:
- `src/server/parsers/xiaoyuzhou-simple.ts` - 简化版解析器（关键修复）
- `src/server/asr-segmented.ts` - 分段ASR处理
- `src/server/db-retry.ts` - 数据库重试机制
- `src/utils/error-analyzer.ts` - 错误分析工具
- `src/components/AudioPlayer.tsx` - 音频播放器组件
- `src/components/LikeButton.tsx` - 点赞按钮组件
- `src/server/asr-config.ts` - ASR配置
- `src/app/api/podcast/like/` - 点赞API

**文档文件**:
- `UPDATE_REPORT.md` - 更新报告（重要）
- `DEPLOYMENT_CHECKLIST.md` - 部署检查清单
- `DEPLOYMENT_READINESS_REPORT.md` - 部署就绪性报告

**脚本文件**:
- `scripts/` 目录下的所有脚本（用于数据维护和清理）

---

## ⚠️ 不需要提交的文件（可选）

这些文件通常是临时文件或测试文件，可以选择不提交：

**测试和分析脚本**:
- `test-*.js`, `test-*.ts` - 测试文件
- `analyze-*.js` - 分析脚本
- `check-*.js` - 检查脚本
- `diagnose-*.js` - 诊断脚本
- `update-report-prompt*.js` - 临时脚本

**临时文档**:
- `cleaning-*.md` - 清洗问题分析文档（可选）
- `OPTIMIZATION_ANALYSIS.md` - 优化分析（可选）
- `PROCESSING_ANALYSIS.md` - 处理分析（可选）

**其他**:
- `cookies.txt` - 不应提交（可能包含敏感信息）
- `prisma/migrations/` - 如果使用 `db push` 则不需要

---

## 🚀 提交步骤

### 方法1: 提交所有重要文件（推荐）

```bash
cd /Users/maoweihao/cursor/Ear/podroom

# 1. 添加所有已修改的文件
git add env.example
git add prisma/schema.prisma
git add src/

# 2. 添加重要的新文件
git add src/server/parsers/xiaoyuzhou-simple.ts
git add src/server/asr-segmented.ts
git add src/server/db-retry.ts
git add src/utils/error-analyzer.ts
git add src/components/AudioPlayer.tsx
git add src/components/LikeButton.tsx
git add src/server/asr-config.ts
git add src/app/api/podcast/like/

# 3. 添加重要的文档
git add UPDATE_REPORT.md
git add DEPLOYMENT_CHECKLIST.md
git add DEPLOYMENT_READINESS_REPORT.md

# 4. 添加脚本文件
git add scripts/

# 5. 检查暂存区
git status

# 6. 提交
git commit -m "feat: 修复动态导入问题并优化错误处理

- 修复audio-processor.ts中的动态导入问题（改为静态导入）
- 增强错误处理和日志记录
- 优化前端用户体验（简化处理状态UI，改进轮询机制）
- 增强播客元数据提取（作者、发布时间）
- 优化报告生成（添加原话摘录功能）
- 改进任务队列系统（详细日志、智能重试）
- 更新用户每日上传限制（从5个改为2个）
- 添加UPDATE_REPORT.md更新报告"

# 7. 推送到GitHub
git push origin main
```

### 方法2: 分步提交（更细致）

```bash
# 第一步：提交核心修复
git add src/server/audio-processor.ts
git add src/server/parsers/xiaoyuzhou-simple.ts
git commit -m "fix: 修复动态导入问题，解决fetch failed错误"

# 第二步：提交错误处理改进
git add src/server/task-queue.ts
git add src/utils/error-analyzer.ts
git add src/server/db-retry.ts
git commit -m "feat: 增强错误处理和日志记录"

# 第三步：提交前端优化
git add src/app/home/page.tsx
git add src/components/SimpleProcessingStatus.tsx
git commit -m "feat: 优化前端用户体验和轮询机制"

# 第四步：提交其他改进
git add .
git commit -m "feat: 其他功能改进和优化"

# 推送到GitHub
git push origin main
```

---

## 🔍 提交前检查

### 1. 检查暂存区
```bash
git status
```

### 2. 查看将要提交的更改
```bash
git diff --cached --stat
```

### 3. 确认没有敏感信息
```bash
# 检查是否有.env文件被意外添加
git diff --cached --name-only | grep -E "\.env"
```

---

## 📋 提交后验证

### 1. 检查远程仓库
```bash
git log origin/main -5
```

### 2. 确认推送成功
```bash
git status
# 应该显示 "Your branch is up to date with 'origin/main'"
```

### 3. 在GitHub上验证
- 访问 `https://github.com/njumhw/podhome`
- 检查最新提交
- 确认所有文件都已更新

---

## ⚠️ 注意事项

### 1. 不要提交敏感信息
- `.env` 文件（已在.gitignore中）
- `cookies.txt`（可能包含敏感信息）
- API密钥或密码

### 2. 不要提交临时文件
- `*.tsbuildinfo`
- `node_modules/`
- `.next/`

### 3. 提交前确认
- 代码可以正常构建（`npm run build`）
- 没有TypeScript错误
- 没有明显的bug

---

## 🎯 快速提交命令

如果您想快速提交所有重要更改，可以使用以下命令：

```bash
cd /Users/maoweihao/cursor/Ear/podroom

# 添加所有已修改的文件和新文件（排除测试文件）
git add env.example prisma/schema.prisma src/ scripts/
git add UPDATE_REPORT.md DEPLOYMENT_CHECKLIST.md DEPLOYMENT_READINESS_REPORT.md

# 提交
git commit -m "feat: 修复动态导入问题并优化错误处理

主要改进:
- 修复audio-processor.ts中的动态导入问题
- 增强错误处理和日志记录
- 优化前端用户体验
- 增强播客元数据提取
- 优化报告生成
- 改进任务队列系统
- 更新用户每日上传限制

详见 UPDATE_REPORT.md"

# 推送到GitHub
git push origin main
```

---

## ✅ 完成检查清单

提交后，请确认：

- [ ] 所有重要代码文件已提交
- [ ] 重要文档已提交（UPDATE_REPORT.md等）
- [ ] 没有提交敏感信息（.env等）
- [ ] 提交信息清晰明确
- [ ] 代码已推送到GitHub
- [ ] 在GitHub上验证了最新提交

---

**最后更新**: 2025-11-15

