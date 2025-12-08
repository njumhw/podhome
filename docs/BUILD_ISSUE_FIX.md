# 构建卡住问题修复

## 问题
Next.js构建卡在 "Creating an optimized production build ..." 超过20分钟

## 可能原因
1. 内存不足
2. 构建配置问题
3. 某个文件或依赖有问题
4. Next.js版本问题

## 解决方案

### 方案1：中断并检查系统资源

```bash
# 1. 按 Ctrl+C 中断构建

# 2. 检查内存
free -h

# 3. 检查磁盘空间
df -h

# 4. 检查CPU
top -b -n 1 | head -20
```

### 方案2：使用开发模式（不构建，直接运行）

如果只是测试路由，可以不用构建：

```bash
# 中断构建（Ctrl+C）

# 使用开发模式启动（不需要构建）
pm2 delete podroom  # 删除现有进程
pm2 start npm --name podroom -- run dev -- --port 3005

# 或如果已经有PM2配置
pm2 restart podroom --update-env
```

### 方案3：清理并重新构建（使用更少内存）

```bash
# 1. 中断构建（Ctrl+C）

# 2. 清理构建缓存
rm -rf .next
rm -rf node_modules/.cache

# 3. 使用更少内存构建
NODE_OPTIONS='--max-old-space-size=2048' pnpm build

# 或分步构建
npx prisma generate
NODE_OPTIONS='--max-old-space-size=2048' next build
```

### 方案4：检查是否有构建错误

```bash
# 查看详细构建日志
pnpm build 2>&1 | tee build.log

# 查看最后100行
tail -100 build.log
```

### 方案5：跳过构建，直接测试路由

如果代码文件已经存在，可能不需要重新构建：

```bash
# 1. 中断构建（Ctrl+C）

# 2. 检查应用是否在运行
pm2 list

# 3. 重启应用（使用现有构建）
pm2 restart podroom

# 4. 测试路由
curl http://localhost:3005/mulerun/agent
```

