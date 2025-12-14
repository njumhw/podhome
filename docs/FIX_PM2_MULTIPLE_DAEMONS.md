# 修复多个 PM2 守护进程冲突

## 问题
- 有两个 PM2 守护进程在运行：
  - `/root/.pm2` (PID 1620860)
  - `/tmp/.pm2` (PID 1717601，已停止)
- `next-server` 进程仍在自动重启
- `pm2 kill` 只停止了 `/tmp/.pm2`，`/root/.pm2` 仍在运行

## 解决步骤

### 1. 彻底停止所有 PM2 守护进程

```bash
# 停止所有 PM2 守护进程（包括 /root/.pm2）
kill -9 1620860

# 停止所有 PM2 相关进程
pkill -9 -f "pm2"
pkill -9 -f "PM2"

# 停止所有 next-server 进程
pkill -9 next-server
pkill -9 -f "next start"
pkill -9 -f "sh -c next start"

# 等待 3 秒
sleep 3
```

### 2. 确认所有进程已停止

```bash
# 检查端口
netstat -tlnp | grep :3005
# 应该没有输出

# 检查进程
ps aux | grep -E "next|pm2" | grep -v grep
# 应该没有输出

# 检查 PM2 守护进程
ps aux | grep "PM2.*God Daemon" | grep -v grep
# 应该没有输出
```

### 3. 清理 PM2 状态文件（可选，但推荐）

```bash
# 备份当前 PM2 状态（如果需要）
# cp -r /root/.pm2 /root/.pm2.backup
# cp -r /tmp/.pm2 /tmp/.pm2.backup

# 清理 PM2 状态文件（这会清除所有 PM2 配置）
# rm -rf /root/.pm2
# rm -rf /tmp/.pm2
```

### 4. 重新启动 PM2 和应用

```bash
cd /opt/podroom

# 确认 ecosystem.config.js 配置正确
grep PORT ecosystem.config.js
# 应该显示 PORT: 3005

# 启动应用（PM2 会自动启动守护进程）
pm2 start ecosystem.config.js --env production

# 等待 5 秒
sleep 5

# 检查日志，确认端口
pm2 logs podroom --lines 30 --nostream | grep -E "Local:|Network:"
# 应该显示 "Local: http://localhost:3005"
```

### 5. 验证

```bash
# 1. 检查端口监听
netstat -tlnp | grep :3005
# 应该显示一个 next-server 进程

# 2. 检查 PM2 进程状态
pm2 list
pm2 describe podroom | grep pid

# 3. 确认 PID 一致
# netstat 显示的 PID 应该和 pm2 describe 显示的 pid 一致

# 4. 检查 PM2 守护进程（应该只有一个）
ps aux | grep "PM2.*God Daemon" | grep -v grep
# 应该只显示一个 PM2 守护进程

# 5. 保存 PM2 配置
pm2 save
```

