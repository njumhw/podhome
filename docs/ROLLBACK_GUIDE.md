# 🔙 回滚到稳定版本指南

## 📌 当前稳定版本

**Tag:** `v1.0.0-stable`  
**创建时间:** 2025-12-09  
**状态:** 生产模式运行正常，性能优化完成

---

## 🚨 何时需要回滚？

如果遇到以下情况，建议立即回滚：

- ✅ 新版本上线后服务无法启动
- ✅ 新版本上线后频繁崩溃或重启
- ✅ 新版本上线后出现严重功能问题
- ✅ 新版本上线后性能严重下降
- ✅ 新版本上线后数据库操作失败
- ✅ 任何导致服务不可用的问题

---

## 🔄 快速回滚流程

### 步骤1：停止当前服务

```bash
ssh root@your-server-ip
cd /opt/podroom

# 停止 PM2 进程
pm2 stop podroom
pm2 delete podroom
```

### 步骤2：回退到稳定版本

```bash
# 方式1：使用 tag 回退（推荐）
git fetch origin --tags
git checkout v1.0.0-stable

# 方式2：如果 tag 不存在，使用 commit hash
# git checkout <stable-commit-hash>
```

### 步骤3：重新安装依赖（确保版本一致）

```bash
# 清理 node_modules（可选，但推荐）
rm -rf node_modules

# 重新安装依赖
pnpm install --frozen-lockfile

# 生成 Prisma 客户端
npx prisma generate
```

### 步骤4：重新构建（生产模式）

```bash
# 清理旧的构建产物
rm -rf .next

# 执行构建
NODE_OPTIONS='--max-old-space-size=2048' pnpm build

# 等待构建完成
```

### 步骤5：启动服务

```bash
# 启动生产模式
PORT=3005 pm2 start npm --name podroom -- start

# 保存 PM2 配置
pm2 save

# 查看状态
pm2 list
pm2 logs podroom --lines 30
```

### 步骤6：验证服务

```bash
# 测试首页
curl -I http://localhost:3005/home

# 应该返回 HTTP/1.1 200 OK

# 持续监控 5 分钟
pm2 logs podroom --lines 20
```

---

## 🔄 开发模式回滚（如果构建失败）

如果生产构建失败，可以临时使用开发模式：

```bash
cd /opt/podroom

# 回退到稳定版本
git fetch origin --tags
git checkout v1.0.0-stable

# 安装依赖
pnpm install --frozen-lockfile
npx prisma generate

# 停止当前服务
pm2 stop podroom
pm2 delete podroom

# 启动开发模式
pm2 start pnpm --name podroom -- run dev -- --port 3005

# 保存配置
pm2 save

# 验证
pm2 list
pm2 logs podroom --lines 30
```

---

## 📋 回滚检查清单

回滚后，确认以下项目：

- [ ] Git 版本已回退：`git log --oneline -1` 显示稳定版本
- [ ] 依赖已重新安装：`ls node_modules/.bin/next` 存在
- [ ] 构建产物完整：`ls -la .next/` 存在且大小正常（200MB+）
- [ ] PM2 状态正常：`pm2 list` 显示 `online`
- [ ] 服务可访问：`curl -I http://localhost:3005/home` 返回 200
- [ ] 日志无错误：`pm2 logs podroom` 无大量错误
- [ ] 功能正常：浏览器访问首页和详情页正常

---

## 🔍 查看稳定版本信息

```bash
# 查看所有 tag
git tag -l

# 查看稳定版本的详细信息
git show v1.0.0-stable

# 查看稳定版本的 commit
git log v1.0.0-stable --oneline -5
```

---

## 📝 稳定版本特性

**v1.0.0-stable** 包含以下特性：

- ✅ 生产模式运行正常
- ✅ Next.js 性能优化配置
- ✅ 播客处理流程稳定
- ✅ 前端轮询优化（10秒间隔）
- ✅ 错误处理完善
- ✅ 任务队列自动恢复机制
- ✅ OSS 上传稳定性改进
- ✅ 音频处理并发控制（3个并发）

---

## 🚀 回滚后重新上线新版本

回滚成功后，如果需要重新上线新版本：

1. **分析问题**：找出新版本失败的原因
2. **修复问题**：在本地或测试环境修复
3. **充分测试**：确保修复后功能正常
4. **重新上线**：按照 `DEPLOYMENT_WORKFLOW.md` 流程重新上线
5. **更新稳定版本**：如果新版本稳定运行一段时间，可以创建新的稳定 tag

---

## ⚠️ 注意事项

1. **数据安全**：回滚不会影响数据库数据，已保存的播客数据不会丢失
2. **环境变量**：确保 `.env` 文件配置正确
3. **数据库迁移**：如果新版本有数据库 schema 变更，回滚后可能需要手动处理
4. **备份重要**：回滚前建议备份当前状态（虽然通常不需要）

---

## 🔗 相关文档

- [上线流程](./DEPLOYMENT_WORKFLOW.md)
- [部署 SOP](./DEPLOY_SOP.md)

