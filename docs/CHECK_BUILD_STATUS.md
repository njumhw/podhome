# 检查构建状态指南

## 如何判断构建是否卡住

### 方法1：检查进程是否还在运行

```bash
# 查看npm/node进程
ps aux | grep -E "npm|node|next" | grep -v grep

# 查看CPU使用情况
top -p $(pgrep -f "next build")
```

### 方法2：检查构建输出

如果构建还在进行，应该会看到：
- "Compiling..."
- "Linting and checking validity of types..."
- "Creating an optimized production build..."
- 各种路由和页面的编译信息

### 方法3：检查磁盘空间

```bash
# 检查磁盘空间（构建需要空间）
df -h

# 检查.next目录大小
du -sh .next
```

## 如果确实卡住了

### 方案1：中断并重新构建

```bash
# 按 Ctrl+C 中断当前构建

# 清理构建缓存
rm -rf .next

# 重新构建
npm run build
```

### 方案2：检查是否有错误

```bash
# 查看最近的日志
tail -f /var/log/syslog | grep -i error

# 检查内存使用
free -h

# 如果内存不足，可能需要增加swap空间
```

### 方案3：分步执行

```bash
# 1. 只生成Prisma客户端
npx prisma generate

# 2. 然后单独构建Next.js
next build
```

## 正常构建时间

- 小型应用：1-3分钟
- 中型应用：3-10分钟
- 大型应用：10-30分钟或更长

如果超过30分钟还没有完成，可能是真的卡住了。

