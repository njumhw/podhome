# 修复应用无响应问题

## 问题
- PM2 显示应用状态为 `online`
- 端口 3005 有进程在监听
- 但 `curl` 命令卡住或网页无法访问

## 诊断步骤

### 步骤1：检查应用日志

```bash
# 查看应用日志（最后50行）
pm2 logs podroom --lines 50 --nostream

# 查看错误日志
pm2 logs podroom --err --lines 50 --nostream
```

**检查是否有错误**，特别是：
- 数据库连接失败
- 环境变量缺失
- 端口冲突
- 应用启动失败

### 步骤2：检查应用是否真的在运行

```bash
# 检查进程详情
ps aux | grep 19331

# 检查进程状态
ps -p 19331 -o pid,state,cmd
```

### 步骤3：强制停止并重启应用

```bash
# 停止应用
pm2 stop podroom

# 删除进程
pm2 delete podroom

# 等待2秒
sleep 2

# 检查端口是否已释放
netstat -tlnp | grep :3005

# 重新启动应用
cd /opt/podroom
pm2 start ecosystem.config.js --env production

# 等待5秒
sleep 5

# 检查状态
pm2 list
netstat -tlnp | grep :3005
```

### 步骤4：测试本地访问（带超时）

```bash
# 使用超时测试（5秒超时）
timeout 5 curl -I http://localhost:3005/home

# 或使用
curl --max-time 5 -I http://localhost:3005/home
```

### 步骤5：检查应用启动日志

```bash
# 查看应用启动时的日志
pm2 logs podroom --lines 100 --nostream | head -50
```

**检查是否显示**：
- `Local: http://localhost:3005`
- 或 `Network: http://...`

### 步骤6：检查环境变量

```bash
# 检查环境变量是否正确加载
pm2 env 0 | grep -E "PORT|DATABASE_URL|NODE_ENV"
```

---

## 常见问题和解决方案

### 问题1：应用启动但无法响应

**可能原因**：
- 应用启动失败但 PM2 没有检测到
- 数据库连接失败
- 环境变量缺失

**解决方案**：
```bash
# 查看详细日志
pm2 logs podroom --lines 100 --nostream

# 检查环境变量
pm2 env 0

# 重启应用
pm2 restart podroom
```

### 问题2：应用卡在启动阶段

**可能原因**：
- 构建不完整
- 依赖缺失

**解决方案**：
```bash
# 检查 .next 目录是否存在
ls -la /opt/podroom/.next

# 如果不存在，重新构建
cd /opt/podroom
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 重启应用
pm2 restart podroom
```

### 问题3：端口被占用但应用无法响应

**解决方案**：
```bash
# 停止所有相关进程
pm2 stop all
pm2 delete all
pkill -9 next-server

# 等待3秒
sleep 3

# 重新启动
cd /opt/podroom
pm2 start ecosystem.config.js --env production
```

---

## 快速修复命令

如果应用无响应，执行以下命令：

```bash
cd /opt/podroom

# 停止应用
pm2 stop podroom
pm2 delete podroom

# 等待2秒
sleep 2

# 检查端口
netstat -tlnp | grep :3005
# 应该没有输出

# 重新启动
pm2 start ecosystem.config.js --env production

# 等待5秒
sleep 5

# 检查状态
pm2 list
pm2 logs podroom --lines 30 --nostream

# 测试访问（带超时）
timeout 5 curl -I http://localhost:3005/home
```

