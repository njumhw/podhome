# 停止占用 3005 端口的进程

## 当前情况
- ✅ 发现占用 3005 的进程：`next-server` (PID: 1715303)
- ❓ 这个进程可能是之前启动的实例，或者是监控进程启动的

## 解决步骤

### 1. 查看这个进程的详细信息

```bash
# 查看进程详情
ps -ef | grep 1715303
pstree -ap 1715303

# 查看进程的完整命令行
cat /proc/1715303/cmdline | tr '\0' ' '
# 或
ps -p 1715303 -o cmd=
```

### 2. 检查是否是 PM2 管理的进程

```bash
# 查看 PM2 进程列表
pm2 list

# 查看 PM2 进程的 PID
pm2 describe podroom | grep pid

# 如果 1715303 不在 PM2 列表中，说明是独立运行的进程
```

### 3. 停止这个进程

```bash
# 方法1：正常停止
kill 1715303

# 等待 2 秒
sleep 2

# 检查是否已停止
netstat -tlnp | grep :3005

# 如果还在运行，强制停止
kill -9 1715303

# 再次确认
netstat -tlnp | grep :3005
# 应该没有输出
```

### 4. 停止所有可能的 next-server 进程

```bash
# 停止所有 next-server 进程
pkill -9 next-server

# 停止所有 next start 进程
pkill -9 -f "next start"

# 确认端口已释放
netstat -tlnp | grep :3005
lsof -i :3005
# 应该都没有输出
```

### 5. 等待端口完全释放

```bash
sleep 3
```

### 6. 重新启动应用（应该在 3005 启动）

```bash
cd /opt/podroom

# 确认 ecosystem.config.js 配置的是 3005
grep PORT ecosystem.config.js

# 停止 PM2 进程（如果存在）
pm2 stop podroom
pm2 delete podroom

# 启动应用
pm2 start ecosystem.config.js --env production

# 等待 5 秒
sleep 5

# 检查日志，确认端口
pm2 logs podroom --lines 30 --nostream | grep -E "Local:|Network:|3005|3006"

# 应该显示 "Local: http://localhost:3005"
```

### 7. 验证

```bash
# 检查 3005 端口监听
netstat -tlnp | grep :3005
# 应该显示 PM2 管理的 next-server 进程

# 检查 PM2 进程状态
pm2 list
# 应该显示 online，uptime > 5s，restart = 0 或很小

# 测试访问
curl -I http://localhost:3005/home
```

