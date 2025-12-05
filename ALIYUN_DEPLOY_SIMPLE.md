# 🚀 阿里云服务器部署步骤（简洁版）

## 📋 部署流程

### 1. 连接到服务器
```bash
ssh root@your-server-ip
```

### 2. 进入项目目录
```bash
cd /opt/podroom
```

### 3. 停止应用
```bash
pm2 stop podroom
```

### 4. 拉取最新代码
```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

### 5. 安装依赖
```bash
pnpm install --frozen-lockfile
```

### 6. 生成 Prisma 客户端
```bash
npx prisma generate
```

### 7. 同步数据库 Schema
```bash
npx prisma db push
```

### 8. 构建应用
```bash
pnpm build
```

### 9. 重启应用
```bash
pm2 restart podroom
```

### 10. 保存 PM2 状态
```bash
pm2 save
```

---

## ✅ 验证部署

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs podroom --lines 20

# 健康检查
curl http://localhost:3005/api/health
```

---

## 🔄 快速更新（如果应用已在运行）

```bash
cd /opt/podroom
pm2 stop podroom
git pull
pnpm install
npx prisma generate
npx prisma db push
pnpm build
pm2 restart podroom
pm2 save
```

---

## ⚠️ 注意事项

1. **端口配置**：确保 `.env` 文件中 `PORT=3005`
2. **如果应用未运行**：使用 `pm2 start ecosystem.config.js --env production` 启动
3. **如果端口被占用**：先执行 `kill -9 $(lsof -ti:3005)` 再重启


