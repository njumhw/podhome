# 标准化部署流程

## ✅ 当前状态确认

根据最新部署结果：
- ✅ PM2 状态：`online`，PID 1735169，uptime 22s
- ✅ 端口监听：`next-server` (PID 1735235) 在 3005 端口监听
- ✅ PM2 守护进程：只有一个（`/tmp/.pm2`）
- ✅ 应用日志：显示在 `localhost:3005` 和 `localhost:3006`（这是 Next.js 的正常行为，显示所有网络接口，实际监听端口是 3005）

## 目标
避免端口冲突、多个 PM2 守护进程冲突、自动重启冲突等问题。

## 核心原则

1. **每次部署前，彻底清理所有相关进程**
2. **只使用一个 PM2 守护进程**
3. **确保端口已释放后再启动**
4. **使用统一的启动方式**

---

## 标准部署流程（10步）

### 第一步：连接服务器

```bash
ssh root@your-server-ip
cd /opt/podroom
```

### 第二步：停止应用（如果正在运行）

```bash
# 停止 PM2 管理的应用
pm2 stop all
pm2 delete all

# 停止所有 PM2 守护进程（关键！）
pm2 kill

# 等待 2 秒
sleep 2
```

### 第三步：彻底清理所有相关进程

```bash
# 1. 停止所有 next-server 进程
pkill -9 next-server
pkill -9 -f "next start"
pkill -9 -f "sh -c next start"

# 2. 停止所有 PM2 相关进程（防止残留）
pkill -9 -f "pm2"
pkill -9 -f "PM2"

# 3. 停止监控进程（如果有）
pkill -9 -f "watcher.js"

# 4. 等待 3 秒让系统完全清理
sleep 3
```

### 第四步：确认端口已释放

```bash
# 检查 3005 端口
netstat -tlnp | grep :3005
# 应该没有输出

# 检查进程
ps aux | grep -E "next|pm2" | grep -v grep
# 应该没有输出（或只有系统进程）

# 检查 PM2 守护进程
ps aux | grep "PM2.*God Daemon" | grep -v grep
# 应该没有输出
```

**如果端口仍被占用，重复第三步和第四步。**

### 第五步：拉取最新代码

```bash
# 拉取代码
git fetch origin
git reset --hard origin/main
git clean -fd

# 确认代码已更新
git log --oneline -1
```

### 第六步：安装依赖（如果需要）

```bash
# 检查是否需要更新依赖
# 如果 package.json 或 pnpm-lock.yaml 有变化，执行：
pnpm install --frozen-lockfile
```

### 第七步：生成 Prisma 客户端（如果需要）

```bash
# 如果 schema.prisma 有变化，执行：
npx prisma generate
```

### 第八步：同步数据库（如果需要）

```bash
# 如果 schema.prisma 有变化，执行：
npx prisma db push
```

### 第九步：构建应用（生产模式需要）

```bash
# 如果使用生产模式，需要构建
# 限制内存使用，防止 OOM
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 如果构建失败，检查错误并修复
```

### 第十步：启动应用

```bash
# 确认 ecosystem.config.js 配置正确
grep PORT ecosystem.config.js
# 应该显示 PORT: 3005

# 启动应用（PM2 会自动启动守护进程）
pm2 start ecosystem.config.js --env production

# 等待 5 秒让应用完全启动
sleep 5
```

### 第十一步：验证部署

```bash
# 1. 检查 PM2 状态
pm2 list
# 应该显示：
# - status: online
# - uptime: > 5s
# - restarts: 0（或很小）

# 2. 检查端口监听
netstat -tlnp | grep :3005
# 应该显示一个 next-server 进程

# 3. 检查 PM2 守护进程（应该只有一个）
ps aux | grep "PM2.*God Daemon" | grep -v grep
# 应该只显示一个 PM2 守护进程

# 4. 检查日志，确认端口
pm2 logs podroom --lines 30 --nostream | grep -E "Local:|Network:"
# 应该显示 "Local: http://localhost:3005"

# 5. 确认 PID 一致
PM2_PID=$(pm2 describe podroom | grep "pid:" | awk '{print $4}')
NETSTAT_PID=$(netstat -tlnp | grep :3005 | awk '{print $7}' | cut -d'/' -f1)
echo "PM2 PID: $PM2_PID"
echo "Netstat PID: $NETSTAT_PID"
# 这两个 PID 应该一致（或 netstat 的 PID 是 PM2 PID 的子进程）

# 6. 保存 PM2 配置
pm2 save
```

### 第十二步：测试访问

```bash
# 测试本地访问
curl -I http://localhost:3005/home
# 应该返回 200 OK

# 测试公网访问（如果配置了域名）
curl -I https://podcasttoinsight.top/home
# 应该返回 200 OK
```

---

## 常见问题处理

### 问题1：端口仍被占用

```bash
# 找出占用端口的进程
lsof -i :3005
netstat -tlnp | grep :3005

# 记录 PID，检查是什么进程
ps -ef | grep <PID>

# 如果是 PM2 管理的进程，使用 PM2 停止
pm2 stop <name>
pm2 delete <name>

# 如果是独立进程，直接杀掉
kill -9 <PID>

# 重复第三步和第四步
```

### 问题2：多个 PM2 守护进程

```bash
# 检查所有 PM2 守护进程
ps aux | grep "PM2.*God Daemon" | grep -v grep

# 如果发现多个，全部停止
pm2 kill
pkill -9 -f "PM2.*God Daemon"

# 等待 3 秒
sleep 3

# 重新启动应用（PM2 会自动启动一个守护进程）
pm2 start ecosystem.config.js --env production
```

### 问题3：应用自动重启

```bash
# 检查是否有 systemd 服务在自动重启
systemctl list-units | grep -E "podroom|next|node|watcher"

# 如果有，停止并禁用
systemctl stop <service-name>
systemctl disable <service-name>

# 检查是否有监控进程
ps aux | grep watcher | grep -v grep

# 如果有，停止它们
pkill -9 -f "watcher.js"
```

### 问题4：应用启动失败

```bash
# 查看详细日志
pm2 logs podroom --lines 100 --nostream

# 检查常见错误：
# - 端口冲突：重复第三步和第四步
# - 环境变量缺失：检查 .env 文件
# - 数据库连接失败：检查 DATABASE_URL
# - 构建失败：检查 .next 目录是否存在
```

---

## 快速部署脚本（可选）

可以创建一个脚本来自动化这些步骤：

```bash
#!/bin/bash
# deploy.sh

set -e  # 遇到错误立即退出

echo "=== 停止应用 ==="
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
sleep 2

echo "=== 清理进程 ==="
pkill -9 next-server 2>/dev/null || true
pkill -9 -f "next start" 2>/dev/null || true
pkill -9 -f "sh -c next start" 2>/dev/null || true
pkill -9 -f "pm2" 2>/dev/null || true
pkill -9 -f "PM2" 2>/dev/null || true
pkill -9 -f "watcher.js" 2>/dev/null || true
sleep 3

echo "=== 确认端口已释放 ==="
if netstat -tlnp | grep :3005 > /dev/null; then
    echo "警告：3005 端口仍被占用，请手动检查"
    exit 1
fi

echo "=== 拉取代码 ==="
git fetch origin
git reset --hard origin/main
git clean -fd

echo "=== 安装依赖 ==="
pnpm install --frozen-lockfile

echo "=== 生成 Prisma ==="
npx prisma generate

echo "=== 同步数据库 ==="
npx prisma db push

echo "=== 构建应用 ==="
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

echo "=== 启动应用 ==="
pm2 start ecosystem.config.js --env production
sleep 5

echo "=== 验证部署 ==="
pm2 list
netstat -tlnp | grep :3005
pm2 logs podroom --lines 30 --nostream | grep -E "Local:|Network:"

echo "=== 保存 PM2 配置 ==="
pm2 save

echo "=== 部署完成 ==="
```

使用方法：
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 检查清单

每次部署后，确认：

- [ ] PM2 状态为 `online`，`uptime > 5s`，`restarts = 0`
- [ ] 只有一个 PM2 守护进程在运行
- [ ] 3005 端口只有一个进程在监听
- [ ] 日志显示应用在 `localhost:3005` 启动
- [ ] `curl http://localhost:3005/home` 返回 200 OK
- [ ] 公网访问（如果配置了）正常

---

## 注意事项

1. **不要跳过清理步骤**：即使看起来没有进程在运行，也要执行清理步骤
2. **使用统一的启动方式**：始终使用 `pm2 start ecosystem.config.js --env production`
3. **不要手动启动多个 PM2 实例**：让 PM2 自动管理守护进程
4. **定期检查**：使用 `pm2 list` 和 `netstat -tlnp | grep :3005` 定期检查状态

