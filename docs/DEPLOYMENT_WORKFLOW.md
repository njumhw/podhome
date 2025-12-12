# 🚀 代码更改后上线流程

## 📋 前置检查清单

上线前，确保以下条件满足：

- [ ] 代码已提交到 GitHub
- [ ] 本地测试通过（如适用）
- [ ] 服务器有足够磁盘空间（`df -h` 检查，至少 5GB 可用）
- [ ] 服务器内存充足（`free -h` 检查，至少 1GB 可用）
- [ ] 当前服务运行正常（`pm2 list` 检查）

---

## 🔄 标准上线流程（生产模式）

### 步骤1：连接服务器并进入项目目录

```bash
ssh root@your-server-ip
cd /opt/podroom
```

### 步骤2：备份当前运行状态（可选但推荐）

```bash
# 查看当前 PM2 状态
pm2 list
pm2 info podroom

# 记录当前 Git commit（用于回滚）
git log --oneline -1 > /tmp/current_commit.txt
cat /tmp/current_commit.txt
```

### 步骤3：拉取最新代码

```bash
git fetch origin
git pull origin main

# 确认代码已更新
git log --oneline -1
```

### 步骤4：安装/更新依赖

```bash
# 使用 frozen-lockfile 确保版本一致
pnpm install --frozen-lockfile

# 如果 Prisma schema 有变化，生成客户端
npx prisma generate
```

### 步骤5：生产构建

```bash
# 清理旧的构建产物（可选，但推荐）
rm -rf .next

# 执行构建（限制内存使用，防止 OOM）
NODE_OPTIONS='--max-old-space-size=2048' pnpm build

# 等待构建完成，应该看到：
# ✓ Compiled successfully
# 或
# ✓ Linting and checking validity of types
# ✓ Collecting page data
# ✓ Generating static pages
# ✓ Finalizing page optimization
```

**⚠️ 如果构建失败：**
- 查看错误信息
- 检查 `next.config.ts` 是否有无效配置
- 检查依赖是否完整
- 如果无法快速修复，**不要继续**，回退到开发模式

### 步骤6：验证构建产物

```bash
# 检查 .next 目录是否存在且完整
ls -la .next/
du -sh .next/

# 应该看到至少 200MB+ 的大小
# 应该包含 server/, static/, BUILD_ID 等文件
```

### 步骤7：停止当前服务

```bash
# 停止 PM2 进程
pm2 stop podroom

# 等待几秒确保进程完全停止
sleep 3

# 验证进程已停止
pm2 list
```

### 步骤8：启动生产模式

```bash
# 方式1：使用 npm start（推荐，已验证可用）
PORT=3005 pm2 start npm --name podroom -- start

# 方式2：如果方式1不行，使用 ecosystem.config.js
# pm2 start ecosystem.config.js --env production

# 保存 PM2 配置
pm2 save
```

### 步骤9：验证服务启动

```bash
# 查看 PM2 状态
pm2 list

# 应该看到 status: online, 且 uptime 在增加

# 查看启动日志（前50行）
pm2 logs podroom --lines 50 --nostream

# 应该看到：
# ✓ Ready in X.Xs
# 🚀 初始化应用...
# 后台任务处理器已启动
# TaskQueue 初始化成功
```

### 步骤10：功能验证

```bash
# 测试首页
curl -I http://localhost:3005/home

# 应该返回 HTTP/1.1 200 OK

# 测试 API
curl http://localhost:3005/api/health

# 如果配置了 Nginx，测试公网访问
curl -I http://your-domain.com/home
```

### 步骤11：监控运行状态（持续观察5分钟）

```bash
# 持续查看日志，确保没有错误
pm2 logs podroom --lines 20

# 检查是否有重启
pm2 list
# 如果 ↺ (restarts) 数字在增加，说明有问题

# 检查资源使用
pm2 monit
# 或
top -b -n 1 | head -20
```

---

## 🔙 快速回滚流程（如果上线失败）

### 情况1：构建失败，还未切换服务

```bash
# 直接回退到开发模式
pm2 stop podroom
pm2 delete podroom
pm2 start pnpm --name podroom -- run dev -- --port 3005
pm2 save
```

### 情况2：服务已切换但运行异常

```bash
# 停止生产模式
pm2 stop podroom
pm2 delete podroom

# 回退到开发模式
pm2 start pnpm --name podroom -- run dev -- --port 3005
pm2 save

# 查看日志确认恢复
pm2 logs podroom --lines 30
```

### 情况3：需要回退到之前的代码版本

```bash
# 查看之前的 commit
git log --oneline -10

# 回退到指定 commit（例如：abc1234）
git reset --hard abc1234

# 重新执行上线流程（从步骤4开始）
```

---

## 🛠️ 开发模式上线流程（临时方案）

如果生产构建失败或服务器资源不足，可以使用开发模式：

```bash
cd /opt/podroom

# 拉取代码
git pull origin main

# 安装依赖
pnpm install --frozen-lockfile
npx prisma generate

# 停止当前服务
pm2 stop podroom
pm2 delete podroom

# 启动开发模式
pm2 start pnpm --name podroom -- run dev -- --port 3005

# 保存配置
pm2 save

# 验证
pm2 list
pm2 logs podroom --lines 30
```

**⚠️ 注意：** 开发模式性能较差，仅作为临时方案。

---

## 📊 上线后监控检查项

上线后 30 分钟内，持续检查：

- [ ] PM2 状态：`pm2 list` - status 应该是 `online`
- [ ] 重启次数：`pm2 list` - ↺ 不应该持续增加
- [ ] 日志错误：`pm2 logs podroom` - 不应该有大量错误
- [ ] 资源使用：`pm2 monit` - CPU/内存使用正常
- [ ] 页面访问：浏览器访问首页和详情页，速度正常
- [ ] API 响应：`curl http://localhost:3005/api/health` - 返回正常

---

## 🚨 常见问题处理

### 问题1：构建卡住超过 20 分钟

```bash
# 中断构建（Ctrl+C）
# 检查内存和磁盘
free -h
df -h

# 如果内存不足，增加 swap 或清理空间
# 如果磁盘不足，清理空间

# 重新构建，降低内存限制
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

### 问题2：PM2 启动后立即退出

```bash
# 查看详细错误日志
pm2 logs podroom --lines 100 --nostream

# 手动测试启动
PORT=3005 pnpm run start
# 看具体报什么错误

# 检查 .next 目录是否完整
ls -la .next/
```

### 问题3：端口被占用

```bash
# 检查端口占用
sudo lsof -i :3005

# 如果被占用，停止占用进程或更换端口
```

### 问题4：服务启动但无法访问

```bash
# 检查防火墙
sudo ufw status

# 检查 Nginx（如果使用）
sudo nginx -t
sudo systemctl status nginx

# 检查应用日志
pm2 logs podroom --lines 50
```

---

## 📝 上线记录模板

每次上线后，建议记录：

```
日期：YYYY-MM-DD
操作人：[你的名字]
变更内容：[简要描述]
Git Commit：[commit hash]
上线方式：[生产模式/开发模式]
构建耗时：[X分钟]
验证结果：[通过/失败]
备注：[任何异常或注意事项]
```

---

## ✅ 快速参考命令（一键上线）

**生产模式上线：**
```bash
cd /opt/podroom && \
git pull origin main && \
pnpm install --frozen-lockfile && \
npx prisma generate && \
rm -rf .next && \
NODE_OPTIONS='--max-old-space-size=2048' pnpm build && \
pm2 stop podroom && \
sleep 3 && \
PORT=3005 pm2 start npm --name podroom -- start && \
pm2 save && \
pm2 list && \
pm2 logs podroom --lines 30
```

**开发模式上线（临时）：**
```bash
cd /opt/podroom && \
git pull origin main && \
pnpm install --frozen-lockfile && \
npx prisma generate && \
pm2 stop podroom && \
pm2 delete podroom && \
pm2 start pnpm --name podroom -- run dev -- --port 3005 && \
pm2 save && \
pm2 list
```

---

## 🎯 最佳实践

1. **小步快跑**：频繁小改动比大改动更安全
2. **先测试后上线**：本地或测试环境先验证
3. **保留回滚方案**：始终知道如何快速回退
4. **监控先行**：上线后持续观察至少 30 分钟
5. **记录问题**：遇到问题及时记录，避免重复犯错

