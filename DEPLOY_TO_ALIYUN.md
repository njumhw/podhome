# 🚀 阿里云服务器部署步骤（端口 3005）

## 📋 部署前准备

### 1. 连接到服务器
```bash
ssh root@your-server-ip
# 或使用你的用户名
ssh your-username@your-server-ip
```

### 2. 进入项目目录
```bash
cd /opt/podroom
```

---

## 🔄 方案一：使用自动化部署脚本（推荐）

### 执行部署
```bash
# 给脚本执行权限
chmod +x scripts/deploy.sh

# 执行部署（会自动停止旧应用、拉取代码、构建、重启）
sudo ./scripts/deploy.sh production main
```

**脚本会自动执行**：
1. ✅ 创建必要目录
2. ✅ 备份当前版本
3. ✅ **停止现有应用（包括端口 3005 的进程）**
4. ✅ 拉取最新代码（从 GitHub）
5. ✅ 安装依赖（pnpm install）
6. ✅ 生成 Prisma 客户端
7. ✅ 构建应用（pnpm build）
8. ✅ 同步数据库 schema（prisma db push）
9. ✅ 启动应用（PM2，端口 3005）
10. ✅ 健康检查
11. ✅ 清理旧备份

---

## 🔧 方案二：手动部署（逐步执行）

### 步骤 1: 停止现有应用
```bash
cd /opt/podroom

# 停止 PM2 应用
pm2 stop podroom

# 检查并停止占用端口 3005 的进程
PORT_PID=$(lsof -ti:3005 2>/dev/null || true)
if [ ! -z "$PORT_PID" ]; then
    echo "发现端口 3005 被占用 (PID: $PORT_PID)，正在停止..."
    kill -9 $PORT_PID
    sleep 2
fi

# 确认端口已释放
lsof -i:3005
```

### 步骤 2: 拉取最新代码
```bash
cd /opt/podroom
git fetch origin
git reset --hard origin/main
git clean -fd
```

### 步骤 3: 安装依赖
```bash
cd /opt/podroom
pnpm install --frozen-lockfile
# 或使用 npm
# npm install --frozen-lockfile
```

### 步骤 4: 生成 Prisma 客户端
```bash
cd /opt/podroom
npx prisma generate
```

### 步骤 5: 同步数据库 Schema
```bash
cd /opt/podroom
npx prisma db push
```

### 步骤 6: 构建应用
```bash
cd /opt/podroom
pnpm build
# 或使用 npm
# npm run build
```

### 步骤 7: 启动应用
```bash
# 启动 PM2 应用（端口 3005）
pm2 start ecosystem.config.js --env production

# 保存 PM2 配置
pm2 save

# 检查应用状态
pm2 status
```

---

## ✅ 验证部署

### 1. 检查应用状态
```bash
pm2 status
```

### 2. 查看应用日志
```bash
pm2 logs podroom --lines 50
```

### 3. 健康检查
```bash
curl http://localhost:3005/api/health
```

### 4. 检查端口占用
```bash
lsof -i:3005
```

### 5. 检查功能
- 访问首页：打开浏览器访问你的域名
- 测试登录/注册
- 测试播客上传
- 检查播客处理流程

---

## 🚨 如果遇到问题

### 问题 1: 端口 3005 被占用
```bash
# 查看占用端口的进程
lsof -i:3005

# 停止占用端口的进程
kill -9 $(lsof -ti:3005)

# 或使用 PM2 停止
pm2 stop podroom
pm2 delete podroom
```

### 问题 2: 应用启动失败
```bash
# 查看详细日志
pm2 logs podroom --err

# 检查环境变量
cd /opt/podroom
cat .env | grep -v "SECRET\|KEY\|PASSWORD"

# 检查端口占用
sudo lsof -i :3005
```

### 问题 3: 构建失败
```bash
# 清理构建缓存
rm -rf .next
rm -rf node_modules/.cache

# 重新安装依赖
rm -rf node_modules
pnpm install

# 重新构建
pnpm build
```

### 问题 4: 数据库连接失败
```bash
# 测试数据库连接
psql "$DATABASE_URL" -c "SELECT 1;"
```

### 问题 5: PM2 进程异常
```bash
# 停止所有进程
pm2 stop all

# 删除进程
pm2 delete podroom

# 重新启动
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## 📝 快速更新命令（小改动）

如果只是小改动，可以使用快速更新：

```bash
cd /opt/podroom

# 停止应用
pm2 stop podroom

# 拉取代码
git pull

# 安装依赖
pnpm install

# 生成 Prisma 客户端
npx prisma generate

# 构建应用
pnpm build

# 重启应用
pm2 restart podroom
```

---

## 🎯 部署检查清单

部署前确认：
- [ ] 已连接到服务器
- [ ] 已进入 `/opt/podroom` 目录
- [ ] `.env` 文件配置正确（PORT=3005）
- [ ] 数据库连接正常
- [ ] 已停止旧应用

部署后验证：
- [ ] `pm2 status` 显示应用在线
- [ ] `curl http://localhost:3005/api/health` 返回正常
- [ ] `lsof -i:3005` 显示应用正在监听
- [ ] 浏览器可以访问首页
- [ ] 可以登录/注册
- [ ] 可以上传播客
- [ ] 播客处理流程正常

---

## ⚠️ 重要提示

1. **端口配置**：确保 `.env` 文件中 `PORT=3005`
2. **停止旧应用**：部署前必须先停止旧应用，避免端口冲突
3. **PM2 配置**：`ecosystem.config.js` 中端口已设置为 3005
4. **Nginx 配置**：如果使用 Nginx 反向代理，确保代理到 `http://127.0.0.1:3005`

---

**祝部署顺利！** 🎉
