# 详细部署步骤指南

## 前提条件

- 已配置SSH密钥，可以连接到服务器
- 服务器上已安装：Node.js 18+、pnpm、PM2
- 项目目录：`/opt/podroom`
- 应用端口：`3005`

---

## 完整部署流程

### 步骤1: 连接到服务器

```bash
# 使用SSH连接到服务器
ssh root@47.117.77.211
# 或使用你的用户名
ssh admin@47.117.77.211

# 进入项目目录
cd /opt/podroom
```

### 步骤2: 检查当前状态

```bash
# 查看当前代码版本
git log --oneline -1

# 查看PM2应用状态
pm2 status

# 查看当前运行的进程
pm2 list

# 查看最近的日志（可选）
pm2 logs podroom --lines 20
```

### 步骤3: 备份当前代码（可选但推荐）

```bash
# 创建备份目录
mkdir -p ~/backups/podroom

# 备份当前代码（如果担心出问题）
cp -r /opt/podroom ~/backups/podroom/backup-$(date +%Y%m%d-%H%M%S)
```

### 步骤4: 更新代码

```bash
# 确保在项目目录
cd /opt/podroom

# 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin

# 查看将要更新的内容（可选）
git log HEAD..origin/main --oneline

# 拉取并合并代码
git pull origin main

# 确认更新成功
echo "✅ 当前代码版本:"
git log --oneline -1
```

**如果遇到冲突**：
```bash
# 如果有本地修改导致冲突，先暂存
git stash

# 然后重新拉取
git pull origin main

# 恢复本地修改（如果需要）
git stash pop
```

### 步骤5: 检查环境变量

```bash
# 确认.env文件存在
ls -la .env

# 检查关键环境变量（不显示完整值，只确认存在）
echo "检查环境变量..."
grep -E "^ALIYUN_ACCESS_KEY_ID|^ALIYUN_OSS_REGION|^ALIYUN_OSS_BUCKET|^DATABASE_URL|^QWEN_API_KEY" .env | sed 's/=.*/=***/' 

# 如果.env文件不存在或配置不完整，需要创建/编辑
nano .env
```

### 步骤6: 安装依赖

```bash
# 安装/更新依赖
echo "📦 安装依赖..."
pnpm install --frozen-lockfile

# 如果遇到问题，可以尝试清理后重新安装
# rm -rf node_modules pnpm-lock.yaml
# pnpm install
```

**预期输出**：
```
Packages: +xxx
++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved xxx, reused xxx, downloaded xxx, added xxx
```

### 步骤7: 生成Prisma客户端

```bash
# 生成Prisma客户端（必须步骤）
echo "🗄️ 生成Prisma客户端..."
pnpm prisma generate

# 预期输出：
# Prisma Client generated successfully
```

### 步骤8: 构建应用

```bash
# 构建Next.js应用
echo "🔨 构建应用..."
echo "⚠️ 这可能需要5-15分钟，请耐心等待..."

# 使用增加内存限制的方式构建（推荐）
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 或者直接构建（如果服务器内存充足）
# pnpm build
```

**构建过程说明**：
- Prisma生成：约1-2秒
- Next.js编译：约5-15分钟（取决于服务器性能）
- 如果超过20分钟未完成，按 `Ctrl+C` 中断，检查错误

**构建成功标志**：
```
✓ Compiled successfully
```

**如果构建失败**：
```bash
# 查看详细错误信息
# 常见问题：
# 1. 内存不足：确保swap已启用
# 2. 磁盘空间不足：df -h 检查，清理空间
# 3. 依赖问题：rm -rf node_modules && pnpm install
```

### 步骤9: 停止现有应用

```bash
# 停止PM2应用（优雅停止，等待当前请求完成）
echo "⏸️ 停止现有应用..."
pm2 stop podroom

# 等待几秒确保进程完全停止
sleep 3

# 检查是否已停止
pm2 status
```

### 步骤10: 重启应用

```bash
# 使用PM2重启应用（会自动加载新的构建文件）
echo "▶️ 重启应用..."
pm2 restart podroom

# 或者如果应用不存在，启动它
# pm2 start ecosystem.config.js --env production

# 等待应用启动（约10-20秒）
sleep 5

# 检查应用状态
pm2 status
```

**预期状态**：
```
┌─────┬──────────┬─────────┬─────────┬──────────┐
│ id  │ name     │ status  │ restart │ uptime   │
├─────┼──────────┼─────────┼─────────┼──────────┤
│ 0   │ podroom  │ online  │ 0       │ 5s       │
└─────┴──────────┴─────────┴─────────┴──────────┘
```

### 步骤11: 验证部署

```bash
# 1. 检查PM2状态
echo "📊 PM2状态:"
pm2 status

# 2. 查看应用日志（检查是否有错误）
echo "📝 查看应用日志（最近20行）:"
pm2 logs podroom --lines 20 --nostream

# 3. 检查应用是否响应
echo "🌐 测试应用响应:"
curl -I http://localhost:3005

# 预期输出：
# HTTP/1.1 200 OK
# 或
# HTTP/1.1 301 Moved Permanently
```

### 步骤12: 保存PM2配置（确保开机自启）

```bash
# 保存PM2进程列表
pm2 save

# 如果提示需要设置开机自启，执行：
# pm2 startup
# 然后按照提示执行输出的命令
```

---

## 快速部署脚本（一键执行）

如果你熟悉流程，可以使用以下脚本快速部署：

```bash
#!/bin/bash
set -e

echo "🚀 开始部署..."

cd /opt/podroom

# 1. 更新代码
echo "📥 更新代码..."
git pull origin main

# 2. 安装依赖
echo "📦 安装依赖..."
pnpm install --frozen-lockfile

# 3. 生成Prisma
echo "🗄️ 生成Prisma客户端..."
pnpm prisma generate

# 4. 构建应用
echo "🔨 构建应用..."
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 5. 重启应用
echo "▶️ 重启应用..."
pm2 restart podroom

# 6. 保存配置
pm2 save

echo "✅ 部署完成！"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs podroom"
```

**使用方法**：
```bash
# 将脚本保存为 deploy-quick.sh
nano deploy-quick.sh
# 粘贴上面的脚本内容

# 添加执行权限
chmod +x deploy-quick.sh

# 执行
./deploy-quick.sh
```

---

## 常见问题排查

### 问题1: 构建失败 - 内存不足

**症状**：
```
FATAL ERROR: Reached heap limit Allocation failed
```

**解决**：
```bash
# 检查swap空间
free -h

# 如果没有swap，创建2GB swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# 永久启用
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 使用增加内存限制的方式构建
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

### 问题2: 构建失败 - 磁盘空间不足

**症状**：
```
ENOSPC: no space left on device
```

**解决**：
```bash
# 检查磁盘空间
df -h

# 清理空间
# 1. 清理npm缓存
pnpm store prune

# 2. 清理旧的构建文件
rm -rf .next

# 3. 清理日志（如果太大）
pm2 flush
```

### 问题3: 应用启动失败

**症状**：
```
pm2 status 显示 status: errored
```

**排查**：
```bash
# 查看详细错误日志
pm2 logs podroom --err --lines 50

# 检查常见问题：
# 1. 端口被占用
lsof -i :3005

# 2. 环境变量缺失
pm2 env podroom | grep ALIYUN

# 3. 数据库连接问题
# 检查 .env 中的 DATABASE_URL
```

### 问题4: 应用无法访问

**排查**：
```bash
# 1. 检查应用是否运行
pm2 status

# 2. 检查端口监听
netstat -tlnp | grep 3005
# 或
ss -tlnp | grep 3005

# 3. 检查防火墙
ufw status
# 如果需要开放端口
ufw allow 3005/tcp

# 4. 检查应用日志
pm2 logs podroom --lines 50
```

---

## 回滚到上一个版本

如果新版本有问题，可以快速回滚：

```bash
cd /opt/podroom

# 1. 查看提交历史
git log --oneline -10

# 2. 回滚到上一个提交
git reset --hard HEAD~1

# 或回滚到特定提交
# git reset --hard <commit-hash>

# 3. 重新构建和重启
pnpm install --frozen-lockfile
pnpm prisma generate
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
pm2 restart podroom
```

---

## 部署后验证清单

- [ ] 代码已更新到最新版本（`git log -1`）
- [ ] 依赖已安装（`ls node_modules`）
- [ ] Prisma客户端已生成（`ls node_modules/.prisma/client`）
- [ ] 应用已构建（`ls .next`）
- [ ] PM2应用状态为 `online`（`pm2 status`）
- [ ] 应用可以访问（`curl http://localhost:3005`）
- [ ] 日志中没有错误（`pm2 logs podroom --lines 20`）
- [ ] 可以处理播客（测试上传一个播客URL）

---

## 监控和维护

### 日常监控

```bash
# 查看应用状态
pm2 status

# 查看实时日志
pm2 logs podroom

# 查看资源使用
pm2 monit

# 查看应用信息
pm2 info podroom
```

### 定期维护

```bash
# 每周检查一次
# 1. 清理旧日志
pm2 flush

# 2. 检查磁盘空间
df -h

# 3. 检查内存使用
free -h

# 4. 更新系统（谨慎操作）
# apt update && apt upgrade -y
```

---

## 总结

**标准部署流程**：
1. SSH连接服务器
2. 进入项目目录：`cd /opt/podroom`
3. 更新代码：`git pull origin main`
4. 安装依赖：`pnpm install --frozen-lockfile`
5. 生成Prisma：`pnpm prisma generate`
6. 构建应用：`NODE_OPTIONS='--max-old-space-size=1536' pnpm build`
7. 重启应用：`pm2 restart podroom`
8. 验证部署：`pm2 status` 和 `curl http://localhost:3005`

**预计时间**：10-20分钟（主要取决于构建时间）
