# 启动应用解决端口问题

## 问题分析

`lsof -i :3005` 显示的都是 `ESTABLISHED` 连接，说明：
- Nginx 在尝试连接到 `localhost:3005`
- 但**没有进程在监听（LISTEN）3005 端口**
- 所以 Nginx 无法代理请求

## 解决方案

需要启动应用，让它监听 3005 端口。

### 1. 检查是否有进程在监听 3005

```bash
lsof -i :3005 | grep LISTEN
```

如果没有输出，说明确实没有进程在监听。

### 2. 启动应用

```bash
cd /opt/podroom

# 使用 PM2 启动（开发模式）
pm2 start pnpm --name podroom -- run dev

# 保存配置
pm2 save
```

### 3. 等待几秒后检查

```bash
# 检查 PM2 状态
pm2 list

# 检查是否有进程在监听 3005
lsof -i :3005 | grep LISTEN

# 查看日志
pm2 logs podroom --lines 30
```

### 4. 验证

应该看到：
- PM2 中 `podroom` 进程状态为 `online`
- `lsof -i :3005 | grep LISTEN` 显示有进程在监听
- 日志中没有端口冲突错误

