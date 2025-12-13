# 查找实际运行的进程

## 问题分析

- 线上页面可以正常使用
- 但 PM2 启动时报端口冲突
- 说明有进程在监听 3005，但不是 PM2 管理的

## 诊断步骤

### 1. 检查是否有进程在监听 3005

```bash
lsof -i :3005 | grep LISTEN
```

如果有输出，说明确实有进程在监听。

### 2. 检查所有 Node.js 进程

```bash
ps aux | grep node
```

查看所有 Node.js 进程，找出哪个在监听 3005。

### 3. 检查 PM2 进程

```bash
pm2 list
```

### 4. 找出监听 3005 的进程 PID

```bash
# 方法1：使用 lsof
lsof -i :3005 | grep LISTEN | awk '{print $2}'

# 方法2：使用 netstat
netstat -tlnp | grep :3005
```

### 5. 停止占用端口的进程

```bash
# 如果找到了 PID（假设是 12345）
kill -9 <PID>

# 或者停止所有 next start 进程
pkill -f "next start"
```

### 6. 确认端口已释放

```bash
lsof -i :3005 | grep LISTEN
```

应该没有输出。

### 7. 重新启动 PM2

```bash
pm2 restart podroom
# 或者
pm2 delete podroom
PORT=3005 pm2 start npm --name podroom -- start
```

