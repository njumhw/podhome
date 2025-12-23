# 服务器代码更新部署步骤

## 📋 前提条件
- 服务器已配置好 Node.js、pnpm、PM2
- 项目目录：`/opt/podroom`
- 应用运行在 3005 端口
- 使用 PM2 管理进程

---

## 第一步：SSH 连接到服务器

```bash
ssh root@your-server-ip
# 或使用你的用户名
```

---

## 第二步：进入项目目录并备份当前代码（可选）

```bash
cd /opt/podroom

# 查看当前状态
git status

# 可选：创建备份分支（如果需要回滚）
git branch backup-$(date +%Y%m%d-%H%M%S)
```

---

## 第三步：拉取最新代码

```bash
# 确保在 main 分支
git checkout main

# 拉取最新代码
git pull origin main

# 查看最新提交
git log --oneline -1
```

**预期输出**：
- 应该看到最新的提交信息，例如：`feat: 优化播客详情页UI和英文播客翻译功能`

---

## 第四步：安装/更新依赖

```bash
# 安装最新依赖
pnpm install

# 如果遇到网络问题，可以使用国内镜像
# pnpm install --registry https://registry.npmmirror.com
```

---

## 第五步：运行数据库迁移（重要！）

### 情况 A：正常迁移（推荐）

```bash
# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移（应用新的 schema 变更）
npx prisma migrate deploy

# 验证迁移成功
npx prisma migrate status
```

### 情况 B：遇到 P3005 错误（数据库已有数据）

如果遇到 `P3005: The database schema is not empty` 错误：

```bash
# 1. 手动添加字段（如果迁移只是添加字段）
npx prisma db execute --stdin <<'EOF'
ALTER TABLE "Podcast" 
ADD COLUMN IF NOT EXISTS "translatedTranscript" TEXT,
ADD COLUMN IF NOT EXISTS "translatedSummary" TEXT;

ALTER TABLE "AudioCache" 
ADD COLUMN IF NOT EXISTS "translatedTranscript" TEXT,
ADD COLUMN IF NOT EXISTS "translatedSummary" TEXT;
EOF

# 2. 标记迁移为已应用（如果网络正常）
npx prisma migrate resolve --applied 20251223094404_add_translation_fields

# 如果网络有问题，可以跳过标记，直接继续下一步
# 字段已添加，应用可以正常使用
```

### 情况 C：网络连接问题（P1001 错误）

如果 `migrate resolve` 因为网络问题失败，但字段已添加成功：

```bash
# 直接生成 Prisma Client 并继续
npx prisma generate

# 验证字段是否存在（可选）
npx prisma db execute --stdin <<'EOF'
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name IN ('translatedTranscript', 'translatedSummary');
EOF
```

**注意**：
- 如果字段已手动添加，标记迁移只是更新历史记录，不影响功能
- 可以等网络恢复后再标记，或直接继续部署

---

## 第六步：构建应用

```bash
# 构建生产版本
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

**如果构建失败（网络问题）**：
- 检查代理设置或网络连接
- Google Fonts 连接失败不影响功能，可以忽略
- 如果必须解决，可以配置代理或使用国内镜像

---

## 第七步：重启 PM2 应用

```bash
# 查看当前 PM2 进程
pm2 list

# 停止当前应用
pm2 stop podroom

# 删除旧进程（如果需要）
# pm2 delete podroom

# 重新启动应用
cd /opt/podroom
pm2 start ecosystem.config.js --env production

# 或者如果进程还在，直接重启
pm2 restart podroom

# 查看日志确认启动成功
pm2 logs podroom --lines 50
```

---

## 第八步：验证部署

```bash
# 1. 检查 PM2 状态
pm2 status

# 2. 检查端口监听
netstat -tlnp | grep 3005
# 或
lsof -i :3005

# 3. 检查应用日志（无错误）
pm2 logs podroom --lines 20 --err

# 4. 测试本地访问
curl -I http://localhost:3005/home

# 5. 测试 HTTPS 访问（如果配置了域名）
curl -I https://podcasttoinsight.top/home
```

**预期结果**：
- PM2 状态显示 `online`
- 端口 3005 被监听
- 日志无严重错误
- HTTP 响应为 200

---

## 第九步：检查 Nginx（如果使用）

```bash
# 检查 Nginx 配置
sudo nginx -t

# 如果配置有变更，重新加载
sudo systemctl reload nginx

# 检查 Nginx 状态
sudo systemctl status nginx
```

---

## 🔧 常见问题排查

### 1. 构建失败（内存不足）
```bash
# 增加 swap 空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 然后重新构建
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

### 2. 数据库迁移失败
```bash
# 检查数据库连接
npx prisma db pull

# 查看迁移状态
npx prisma migrate status

# 手动应用迁移（如果需要）
npx prisma migrate deploy
```

### 3. PM2 启动失败
```bash
# 查看详细错误
pm2 logs podroom --err --lines 100

# 检查环境变量
pm2 env podroom

# 检查端口占用
lsof -i :3005
# 如果被占用，kill 掉占用进程
```

### 4. 应用无法访问
```bash
# 检查防火墙
sudo ufw status

# 检查 Nginx 配置
sudo nginx -t
sudo systemctl status nginx

# 检查域名 DNS
nslookup podcasttoinsight.top
```

---

## 📝 快速更新脚本（可选）

可以创建一个更新脚本 `update.sh`：

```bash
#!/bin/bash
set -e

echo "🚀 开始更新部署..."

cd /opt/podroom

echo "📥 拉取最新代码..."
git pull origin main

echo "📦 安装依赖..."
pnpm install

echo "🗄️ 运行数据库迁移..."
npx prisma generate
npx prisma migrate deploy

echo "🏗️ 构建应用..."
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

echo "🔄 重启应用..."
pm2 restart podroom

echo "✅ 部署完成！"
pm2 status
```

使用方法：
```bash
chmod +x update.sh
./update.sh
```

---

## ⚠️ 重要提醒

1. **数据库备份**：在生产环境更新前，建议先备份数据库
2. **测试环境**：如果有测试环境，先在测试环境验证
3. **回滚方案**：保留当前运行的代码备份，以便快速回滚
4. **监控日志**：部署后持续监控日志，确保无异常

---

## 📊 部署检查清单

- [ ] 代码已拉取到最新版本
- [ ] 依赖安装成功
- [ ] 数据库迁移成功
- [ ] 应用构建成功
- [ ] PM2 进程运行正常
- [ ] 端口 3005 正常监听
- [ ] 应用日志无错误
- [ ] 网站可以正常访问
- [ ] Nginx 配置正常（如使用）

