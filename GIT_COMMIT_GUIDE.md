# Git 提交指南

## ✅ 已完成的准备工作

### 1. 更新记录文件
- ✅ 创建了 `CHANGELOG.md`，记录了 v0.1.1 版本的更新内容

### 2. 版本号更新
- ✅ 更新了 `package.json` 中的版本号：`0.1.0` → `0.1.1`

### 3. 代码修改文件
以下文件已修改，需要提交：

#### 核心代码修改
- `src/server/asr.ts` - ASR 转写支持多语言（自动检测）
- `src/clients/report-generator.ts` - 报告生成支持多语言输入

#### 新增文件
- `CHANGELOG.md` - 更新日志
- `ENGLISH_PODCAST_SUPPORT_ANALYSIS.md` - 英文播客支持分析文档
- `MULTILANG_SUPPORT_CHANGES.md` - 多语言支持修改总结
- `update-report-prompt-multilang.js` - 数据库提示词更新脚本
- `GIT_COMMIT_GUIDE.md` - 本文件

#### 版本更新
- `package.json` - 版本号更新至 0.1.1

---

## 📋 手动提交步骤

如果自动提交失败，请按照以下步骤手动提交：

### 1. 检查 Git 状态
```bash
cd /Users/maoweihao/cursor/Ear
git status
```

### 2. 添加所有修改的文件
```bash
# 添加 podroom 目录下的所有修改
git add podroom/

# 或者单独添加文件
git add podroom/CHANGELOG.md
git add podroom/package.json
git add podroom/src/server/asr.ts
git add podroom/src/clients/report-generator.ts
git add podroom/update-report-prompt-multilang.js
git add podroom/ENGLISH_PODCAST_SUPPORT_ANALYSIS.md
git add podroom/MULTILANG_SUPPORT_CHANGES.md
```

### 3. 提交更改
```bash
git commit -m "feat(podroom): 添加多语言支持 - 支持英文播客处理并生成中文报告

- ASR转写支持自动语言检测（中文/英文）
- 报告生成支持跨语言处理（英文输入→中文输出）
- 更新提示词以支持多语言理解
- 添加相关文档和更新脚本
- 版本更新至 0.1.1"
```

### 4. 推送到 GitHub
```bash
# 检查远程仓库
git remote -v

# 推送到远程（根据你的分支名称选择）
git push origin main
# 或
git push origin master
# 或
git push
```

---

## 📝 提交信息模板

如果使用其他提交信息，可以参考以下格式：

```
feat(podroom): 添加多语言支持

主要变更：
- ASR转写支持自动语言检测（中文/英文）
- 报告生成支持跨语言处理（英文输入→中文输出）
- 更新提示词以支持多语言理解

技术细节：
- 修改 src/server/asr.ts：语言参数从硬编码改为可配置
- 修改 src/clients/report-generator.ts：添加多语言支持说明
- 新增文档和更新脚本

版本：0.1.0 → 0.1.1
```

---

## 🔍 验证提交

提交后，可以通过以下命令验证：

```bash
# 查看最近的提交
git log --oneline -5

# 查看提交的详细信息
git show HEAD

# 查看文件变更
git diff HEAD~1 HEAD --stat
```

---

## 📦 版本标签（可选）

如果需要创建版本标签：

```bash
# 创建标签
git tag -a v0.1.1 -m "版本 0.1.1: 添加多语言支持"

# 推送标签到远程
git push origin v0.1.1
```

---

## ✅ 完成检查清单

- [ ] 所有修改的文件已添加到暂存区
- [ ] 提交信息已填写
- [ ] 代码已提交到本地仓库
- [ ] 代码已推送到远程仓库（GitHub）
- [ ] 版本号已更新（package.json）
- [ ] 更新日志已创建（CHANGELOG.md）

---

**注意**：如果遇到 Git 相关问题，请检查：
1. Git 仓库是否已初始化（`.git` 目录是否存在）
2. 远程仓库是否已配置（`git remote -v`）
3. 是否有推送权限
4. 网络连接是否正常
