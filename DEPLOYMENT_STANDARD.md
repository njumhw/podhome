# 🚀 标准部署流程（已验证）

> 本文档记录了经过验证的完整部署流程，包含所有关键步骤和问题解决方案。

## 📋 部署前准备

### 1. 本地代码提交和推送

```bash
# 在本地项目目录
cd /Users/maoweihao/cursor/Ear/podroom

# 检查修改
git status

# 提交所有修改
git add .
git commit -m "feat: 描述本次更新内容"

# 推送到 GitHub
git push origin main
```

### 2. 连接到服务器

```bash
ssh root@your-server-ip
# 或使用你的用户名
ssh your-username@your-server-ip
```

---

## 🔄 标准部署流程（按顺序执行）

### 步骤 1: 进入项目目录

```bash
cd /opt/podroom
```

### 步骤 2: 检查并更新 Git 配置（重要！）

```bash
# 检查 Git 版本
git --version

# 更新 GnuTLS 库（如果之前遇到过 TLS 问题）
apt update
apt upgrade libgnutls30 gnutls-bin -y

# 配置 Git 使用更稳定的 HTTP 设置
git config --global http.version HTTP/1.1
git config --global http.postBuffer 52428800
git config --global http.timeout 30
git config --global http.compression false
git config --global http.sslVerify true

# 取消之前可能的错误配置
git config --global --unset http.sslBackend 2>/dev/null || true
```

### 步骤 3: 检查当前 Git 状态

```bash
# 查看当前分支和状态
git branch -a
git status

# 查看当前提交
git log --oneline -1
```

### 步骤 4: 停止现有应用

```bash
# 停止 PM2 应用
pm2 stop podroom 2>/dev/null || echo "应用未运行"

# 检查并停止占用端口 3005 的进程
PORT_PID=$(lsof -ti:3005 2>/dev/null || true)
if [ ! -z "$PORT_PID" ]; then
    echo "发现端口 3005 被占用 (PID: $PORT_PID)，正在停止..."
    kill -9 $PORT_PID
    sleep 2
fi

# 确认端口已释放
lsof -i:3005 || echo "端口 3005 已释放"
```

### 步骤 5: 备份重要文件

```bash
# 备份 .env 文件（重要！）
if [ -f .env ]; then
    cp .env /tmp/podroom.env.backup
    echo "✅ .env 文件已备份到 /tmp/podroom.env.backup"
fi

# 备份当前代码（可选，如果需要回滚）
cp -r /opt/podroom /opt/podroom.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
```

### 步骤 6: 拉取最新代码（使用稳定方法）

```bash
cd /opt/podroom

# 方法 1: 使用 fetch + reset（推荐，更稳定）
git fetch origin main
git reset --hard origin/main
git clean -fd

# 验证拉取成功
git log --oneline -1
echo "当前提交: $(git log --oneline -1)"
```

**如果步骤 6 遇到 TLS 错误（`GnuTLS recv error (-110)`）：**

```bash
# 先更新 GnuTLS（如果还没更新）
apt update && apt upgrade libgnutls30 gnutls-bin -y

# 如果还是失败，检查仓库状态
git status
git branch -a

# 如果仓库损坏，重建
rm -rf .git
git init
git remote add origin https://github.com/njumhw/podhome.git
git fetch --depth 1 origin main
git reset --hard origin/main
```

### 步骤 7: 恢复 .env 文件

```bash
# 恢复 .env 文件（如果备份存在）
if [ -f /tmp/podroom.env.backup ]; then
    cp /tmp/podroom.env.backup .env
    echo "✅ .env 文件已恢复"
else
    echo "⚠️  未找到 .env 备份，请手动检查 .env 文件"
fi
```

### 步骤 8: 安装依赖

```bash
cd /opt/podroom

# 安装依赖
pnpm install

# 如果遇到问题，清理后重装
# rm -rf node_modules
# pnpm install
```

### 步骤 9: 生成 Prisma 客户端

```bash
cd /opt/podroom
npx prisma generate
```

### 步骤 10: 构建应用

```bash
cd /opt/podroom
pnpm build
```

**如果构建失败：**

```bash
# 检查具体错误信息
pnpm build 2>&1 | tail -50

# 常见问题：缺少导入
# 检查报错的文件，确保所有导入都正确

# 清理缓存后重试
rm -rf .next
pnpm build
```

### 步骤 11: 启动应用

```bash
cd /opt/podroom

# 检查 PM2 中是否已有 podroom 进程
pm2 list | grep podroom

# 如果不存在，启动新进程
if ! pm2 list | grep -q podroom; then
    echo "启动新应用..."
    pm2 start ecosystem.config.js --env production
else
    echo "重启现有应用..."
    pm2 restart podroom
fi

# 保存 PM2 配置
pm2 save
```

### 步骤 12: 验证部署

```bash
# 1. 检查 PM2 状态
pm2 status

# 2. 查看应用日志（检查是否有错误）
pm2 logs podroom --lines 50

# 3. 健康检查
curl http://127.0.0.1:3005/api/health || echo "应用可能还在启动中..."

# 4. 检查端口占用
lsof -i:3005

# 5. 验证代码版本
cd /opt/podroom
git log --oneline -1
```

---

## ✅ 部署检查清单

### 部署前检查
- [ ] 本地代码已提交并推送到 GitHub
- [ ] 已连接到服务器
- [ ] 已进入 `/opt/podroom` 目录
- [ ] `.env` 文件已备份
- [ ] Git 配置已优化（HTTP/1.1, 超时设置等）

### 部署后验证
- [ ] `git log --oneline -1` 显示最新提交
- [ ] `pnpm build` 构建成功（无错误）
- [ ] `pm2 status` 显示 `podroom` 状态为 `online`
- [ ] `pm2 logs podroom` 无严重错误
- [ ] `curl http://127.0.0.1:3005/api/health` 返回正常
- [ ] `lsof -i:3005` 显示应用正在监听
- [ ] 浏览器可以访问首页
- [ ] 可以正常登录/注册
- [ ] 核心功能正常（上传播客、查看列表等）

---

## 🚨 常见问题排查

### 问题 1: Git 拉取失败 - TLS 错误

**症状：** `GnuTLS recv error (-110): The TLS connection was non-properly terminated`

**解决方案：**
```bash
# 1. 更新 GnuTLS
apt update && apt upgrade libgnutls30 gnutls-bin -y

# 2. 配置 Git
git config --global http.version HTTP/1.1
git config --global http.postBuffer 52428800
git config --global http.timeout 30
git config --global http.compression false

# 3. 使用 fetch + reset 替代 pull
git fetch origin main
git reset --hard origin/main
```

### 问题 2: Git 仓库损坏

**症状：** `git gc` 失败，`Failed to traverse parents of commit`

**解决方案：**
```bash
# 备份 .env
cp .env /tmp/podroom.env.backup

# 重建仓库
rm -rf .git
git init
git remote add origin https://github.com/njumhw/podhome.git
git fetch --depth 1 origin main
git reset --hard origin/main

# 恢复 .env
cp /tmp/podroom.env.backup .env
```

### 问题 3: 构建失败 - 缺少导入

**症状：** `Cannot find name 'xxx'` 或 `Module not found`

**解决方案：**
```bash
# 1. 检查文件是否包含正确的导入
grep -n "import.*xxx" src/path/to/file.tsx

# 2. 如果缺失，添加导入
# 例如：import { createPortal } from 'react-dom';

# 3. 重新构建
pnpm build
```

### 问题 4: PM2 应用启动失败

**症状：** `pm2 status` 显示 `errored` 或 `stopped`

**解决方案：**
```bash
# 1. 查看详细错误日志
pm2 logs podroom --err --lines 100

# 2. 检查环境变量
pm2 env podroom

# 3. 检查端口占用
lsof -i:3005

# 4. 删除并重新启动
pm2 delete podroom
pm2 start ecosystem.config.js --env production
pm2 save
```

### 问题 5: 端口 3005 被占用

**解决方案：**
```bash
# 查看占用端口的进程
lsof -i:3005

# 停止占用端口的进程
kill -9 $(lsof -ti:3005)

# 或使用 PM2 停止
pm2 stop podroom
pm2 delete podroom
```

---

## 📝 快速更新命令（小改动）

如果只是小改动（如修复 bug、UI 调整），可以使用快速更新：

```bash
cd /opt/podroom

# 1. 停止应用
pm2 stop podroom

# 2. 拉取代码
git fetch origin main
git reset --hard origin/main

# 3. 安装依赖（如果有新依赖）
pnpm install

# 4. 生成 Prisma 客户端
npx prisma generate

# 5. 构建应用
pnpm build

# 6. 重启应用
pm2 restart podroom

# 7. 验证
pm2 status
pm2 logs podroom --lines 20
```

---

## 🎯 完整部署命令（一键执行）

如果需要快速执行完整流程，可以使用以下脚本：

```bash
#!/bin/bash
# 标准部署脚本

set -e  # 遇到错误立即退出

cd /opt/podroom

echo "📦 步骤 1: 停止现有应用..."
pm2 stop podroom 2>/dev/null || true
PORT_PID=$(lsof -ti:3005 2>/dev/null || true)
[ ! -z "$PORT_PID" ] && kill -9 $PORT_PID || true
sleep 2

echo "💾 步骤 2: 备份 .env..."
[ -f .env ] && cp .env /tmp/podroom.env.backup || true

echo "📥 步骤 3: 拉取最新代码..."
git fetch origin main
git reset --hard origin/main
git clean -fd

echo "📋 步骤 4: 恢复 .env..."
[ -f /tmp/podroom.env.backup ] && cp /tmp/podroom.env.backup .env || true

echo "📦 步骤 5: 安装依赖..."
pnpm install

echo "🔧 步骤 6: 生成 Prisma 客户端..."
npx prisma generate

echo "🏗️  步骤 7: 构建应用..."
pnpm build

echo "🚀 步骤 8: 启动应用..."
if pm2 list | grep -q podroom; then
    pm2 restart podroom
else
    pm2 start ecosystem.config.js --env production
fi
pm2 save

echo "✅ 步骤 9: 验证部署..."
sleep 3
pm2 status
echo ""
echo "📊 应用日志（最近 20 行）："
pm2 logs podroom --lines 20 --nostream

echo ""
echo "🎉 部署完成！"
echo "当前版本: $(git log --oneline -1)"
```

**使用方法：**
```bash
# 保存为 deploy.sh
chmod +x deploy.sh
./deploy.sh
```

---

## ⚠️ 重要提示

1. **端口配置**：确保 `.env` 文件中 `PORT=3005`，`ecosystem.config.js` 中端口也设置为 3005
2. **停止旧应用**：部署前必须先停止旧应用，避免端口冲突
3. **备份 .env**：每次部署前备份 `.env` 文件，避免配置丢失
4. **Git 配置**：如果遇到 TLS 问题，先更新 GnuTLS 并配置 Git HTTP 设置
5. **验证部署**：部署后务必验证应用状态和功能是否正常

---

## 📚 相关文档

- `DEPLOY_TO_ALIYUN.md` - 基础部署指南
- `ecosystem.config.js` - PM2 配置文件
- `scripts/deploy.sh` - 自动化部署脚本

---

**最后更新：** 2025-11-26  
**验证状态：** ✅ 已验证（2025-11-26 成功部署）


