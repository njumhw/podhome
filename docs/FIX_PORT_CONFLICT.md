# 修复端口冲突问题

## 问题分析

- 有一个 `next start` 进程在运行（PID 1573180）
- CPU 使用率很高（115%），但 CPU 时间很少，说明在频繁重启
- PM2 进程也在尝试启动，导致端口冲突

## 解决步骤

### 1. 检查所有占用 3005 端口的进程

```bash
lsof -i :3005
```

### 2. 停止所有相关进程

```bash
# 停止 PM2 进程
pm2 stop podroom
pm2 delete podroom

# 停止直接运行的 Node.js 进程
kill -9 1573180

# 或者更彻底，停止所有 Node.js 进程
pkill -f "next start"
pkill -f "node.*next"
```

### 3. 确认端口已释放

```bash
lsof -i :3005
```

应该没有输出。

### 4. 检查是否还有其他 Node.js 进程

```bash
ps aux | grep node
```

### 5. 重新启动应用（只用一个方式）

**选项 A：使用 PM2（推荐）**

```bash
cd /opt/podroom

# 开发模式
pm2 start pnpm --name podroom -- run dev

# 或生产模式（需要先构建）
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
pm2 start npm --name podroom -- start
```

**选项 B：直接运行（不推荐，但可以测试）**

```bash
cd /opt/podroom
pnpm run dev
```

### 6. 验证

```bash
pm2 list
pm2 logs podroom --lines 20
```

