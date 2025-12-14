# 停止自动重启机制

## 问题分析
- 杀掉进程后立即又出现新进程
- 说明有自动重启机制在运行
- 可能是：systemd 服务、监控进程、或其他进程管理器

## 解决步骤

### 1. 检查是否有 systemd 服务

```bash
# 检查所有相关服务
systemctl list-units | grep -E "podroom|next|node"

# 检查服务状态
systemctl status podroom 2>/dev/null
systemctl status next 2>/dev/null
systemctl status watcher 2>/dev/null

# 如果有服务，停止并禁用
# systemctl stop <service-name>
# systemctl disable <service-name>
```

### 2. 检查监控进程是否在自动重启应用

```bash
# 查看监控进程的详细信息
ps -ef | grep watcher
cat /var/tmp/watcher.js | head -50

# 检查监控进程是否在监听端口变化
lsof -p 1667084 | grep -E "3005|3006"
lsof -p 1680024 | grep -E "3005|3006"
```

### 3. 停止所有自动重启机制

```bash
# 1. 停止所有 systemd 服务（如果有）
systemctl stop podroom 2>/dev/null
systemctl stop next 2>/dev/null
systemctl stop watcher 2>/dev/null
systemctl disable podroom 2>/dev/null
systemctl disable next 2>/dev/null
systemctl disable watcher 2>/dev/null

# 2. 停止监控进程（如果它们在自动重启应用）
kill -9 1667084 2>/dev/null
kill -9 1680024 2>/dev/null

# 3. 停止所有 next-server 进程
pkill -9 next-server
pkill -9 -f "next start"

# 4. 停止 PM2 进程（暂时停止，稍后重新启动）
pm2 stop all
pm2 delete all
```

### 4. 确认所有进程已停止

```bash
# 等待 3 秒
sleep 3

# 检查端口
netstat -tlnp | grep :3005
# 应该没有输出

# 检查进程
ps aux | grep -E "next|node.*3005" | grep -v grep
# 应该没有输出
```

### 5. 重新启动应用（由 PM2 管理）

```bash
cd /opt/podroom

# 确认 ecosystem.config.js 配置正确
grep PORT ecosystem.config.js

# 启动应用
pm2 start ecosystem.config.js --env production

# 等待 5 秒
sleep 5

# 检查日志
pm2 logs podroom --lines 30 --nostream | grep -E "Local:|Network:"

# 应该显示 "Local: http://localhost:3005"
```

### 6. 验证

```bash
# 检查端口监听
netstat -tlnp | grep :3005
# 应该显示 PM2 管理的进程

# 检查 PM2 进程状态
pm2 list
# 应该显示 online，uptime > 5s

# 保存 PM2 配置
pm2 save
```

