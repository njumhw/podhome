# 构建性能优化指南

## 问题
构建很慢，即使空间已释放

## 可能原因
1. 内存不足（3.5GB总内存，构建需要更多）
2. Next.js构建本身需要时间（首次构建通常较慢）
3. 服务器CPU性能限制

## 解决方案

### 方案1：等待构建完成（如果内存足够）
Next.js构建通常需要5-15分钟，特别是首次构建。

### 方案2：使用开发模式（推荐，快速启动）
开发模式不需要完整构建，启动快，适合测试：

```bash
# 中断构建（Ctrl+C）

# 停止当前应用
pm2 delete podroom

# 使用开发模式
cd /opt/podroom
pm2 start pnpm --name podroom -- run dev -- --port 3005

# 等待启动（通常1-2分钟）
# 然后测试路由
curl http://localhost:3005/mulerun/agent
```

### 方案3：优化构建配置
如果必须使用生产构建，可以：

```bash
# 使用更少内存构建
NODE_OPTIONS='--max-old-space-size=2048' pnpm build

# 或禁用某些优化
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS='--max-old-space-size=2048' pnpm build
```

### 方案4：检查构建进度
在另一个终端查看构建日志：

```bash
# 查看PM2日志（如果应用在运行）
pm2 logs podroom --lines 50

# 或查看系统资源
top -b -n 1 | head -20
```

