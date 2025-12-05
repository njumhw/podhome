# 服务器重启指南

## 🚀 快速重启命令

### 方法 1：使用 PM2 重启（推荐）

```bash
# SSH 连接到服务器后执行
cd /opt/podroom
pm2 restart podroom
```

### 方法 2：停止后启动

```bash
cd /opt/podroom
pm2 stop podroom
pm2 start podroom
```

### 方法 3：完全重启（如果 PM2 有问题）

```bash
cd /opt/podroom
pm2 delete podroom
pm2 start npm --name podroom -- start
# 或者如果有 ecosystem.config.js
pm2 start ecosystem.config.js
```

## 📋 完整重启流程（包含代码更新）

```bash
# 1. SSH 连接到服务器
ssh root@your-server-ip

# 2. 进入项目目录
cd /opt/podroom

# 3. 停止服务
pm2 stop podroom

# 4. 拉取最新代码（如果需要）
git fetch origin && git reset --hard origin/main && git clean -fd

# 5. 安装依赖（如果有更新）
npm install --production
# 或
pnpm install --production

# 6. 构建项目（如果需要）
npm run build
# 或
pnpm build

# 7. 重启服务
pm2 restart podroom

# 8. 查看状态
pm2 status
pm2 logs podroom --lines 50
```

## 🔍 检查服务状态

```bash
# 查看 PM2 进程列表
pm2 list

# 查看 podroom 服务日志
pm2 logs podroom --lines 100

# 查看实时日志
pm2 logs podroom

# 查看服务信息
pm2 info podroom
```

## 🛠️ 如果服务无法启动

### 检查错误

```bash
# 查看错误日志
pm2 logs podroom --err --lines 100

# 查看所有日志
pm2 logs podroom --lines 200
```

### 手动启动测试

```bash
cd /opt/podroom
npm start
# 或
node server.js
# 查看是否有错误信息
```

### 检查端口占用

```bash
# 检查端口是否被占用
lsof -i :3000
# 或
netstat -tulpn | grep 3000
```

## 🔄 使用部署脚本（推荐）

如果之前创建了部署脚本：

```bash
cd /opt/podroom
./scripts/deploy-stable.sh
```

这个脚本会自动：
- 停止服务
- 拉取代码（带重试）
- 安装依赖
- 构建项目
- 重启服务

## ⚠️ 注意事项

1. **备份数据**：重启前确保数据库已备份
2. **检查依赖**：确保所有依赖都已安装
3. **查看日志**：重启后检查日志确认服务正常
4. **测试功能**：重启后测试关键功能是否正常

---

**快速重启命令**：
```bash
cd /opt/podroom && pm2 restart podroom && pm2 logs podroom --lines 20
```


