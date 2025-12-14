# 彻底修复 PM2 重启循环问题

## 问题现象
- PM2 进程在不停重启（restart 次数很高，uptime 很短）
- 日志显示端口冲突：`EADDRINUSE: address already in use :::3005`
- 可能有监控进程或其他进程占用端口

## 完整解决步骤

### 1. 停止所有 PM2 进程和守护进程

```bash
# 停止所有 PM2 管理的进程
pm2 stop all
pm2 delete all

# 杀死所有 PM2 守护进程
pm2 kill

# 确认所有 PM2 进程已停止
ps aux | grep pm2 | grep -v grep
# 应该没有输出，如果有，kill -9 <PID>
```

### 2. 停止所有占用 3005 端口的进程

```bash
# 方法1：使用 lsof
lsof -i :3005 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null

# 方法2：使用 netstat
netstat -tlnp | grep :3005 | awk '{print $7}' | cut -d'/' -f1 | xargs kill -9 2>/dev/null

# 方法3：使用 ss
ss -tlnp | grep :3005 | awk '{print $6}' | cut -d',' -f2 | cut -d'=' -f2 | xargs kill -9 2>/dev/null

# 停止所有 next start 进程
pkill -9 -f "next start"
pkill -9 -f "next-server"
pkill -9 -f "node.*next"
```

### 3. 检查是否有监控进程或系统服务

```bash
# 检查是否有监控进程
ps aux | grep -E "watcher|monitor|watch" | grep -v grep

# 检查是否有 systemd 服务在运行
systemctl list-units | grep -E "podroom|next|node"

# 如果有，停止它们
# systemctl stop <service-name>
# systemctl disable <service-name>
```

### 4. 确认端口已完全释放

```bash
# 多次检查，确保端口已释放
lsof -i :3005
netstat -tlnp | grep :3005
ss -tlnp | grep :3005

# 所有命令都应该没有输出
```

### 5. 等待几秒让系统完全清理

```bash
sleep 5
```

### 6. 检查所有 Node.js 进程

```bash
ps aux | grep node | grep -v grep

# 只应该看到系统进程（如 watcher.js），不应该有 next start 或应用进程
# 如果有应用相关进程，kill -9 <PID>
```

### 7. 重新启动 PM2 守护进程

```bash
# 确保使用统一的 PM2_HOME
export PM2_HOME=/root/.pm2

# 重新启动 PM2（这会启动新的守护进程）
pm2 ping

# 如果失败，可能需要手动启动
# pm2 resurrect
```

### 8. 使用 ecosystem.config.js 启动应用

```bash
cd /opt/podroom

# 确认 ecosystem.config.js 存在
ls -la ecosystem.config.js

# 启动应用
pm2 start ecosystem.config.js --env production

# 等待 5 秒
sleep 5

# 检查状态
pm2 list

# 如果仍然在重启，查看日志
pm2 logs podroom --lines 50 --nostream
```

### 9. 如果仍然在重启

检查日志中的具体错误：

```bash
# 查看错误日志
pm2 logs podroom --err --lines 100 --nostream

# 查看完整日志
pm2 logs podroom --lines 100 --nostream | tail -50
```

可能的原因：
1. **构建失败**：`.next` 目录不存在或损坏
   ```bash
   ls -la .next/
   # 如果不存在，需要重新构建
   NODE_OPTIONS='--max-old-space-size=1536' pnpm build
   ```

2. **环境变量问题**：某些必需的环境变量缺失
   ```bash
   pm2 env 0 | grep -E "DATABASE_URL|MULERUN_AGENT_KEY"
   ```

3. **端口仍然被占用**：有其他进程在启动时占用端口
   ```bash
   # 在启动后立即检查
   pm2 start ecosystem.config.js --env production
   sleep 2
   lsof -i :3005
   netstat -tlnp | grep :3005
   ```

### 10. 最终验证

```bash
# 1. 检查进程状态（应该显示 online，uptime > 10s，restart = 0）
pm2 list

# 2. 检查端口监听
lsof -i :3005 | grep LISTEN
# 应该显示一个进程在监听

# 3. 检查日志（应该没有错误）
pm2 logs podroom --lines 20 --nostream

# 4. 测试应用
curl -I http://localhost:3005
```

## 如果问题仍然存在

请提供：
1. `pm2 list` 的完整输出
2. `pm2 logs podroom --lines 50 --nostream` 的完整输出
3. `lsof -i :3005` 的输出
4. `ps aux | grep node` 的输出

