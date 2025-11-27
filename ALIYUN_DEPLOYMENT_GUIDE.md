# 🚀 阿里云服务器部署完整指南

## 📋 部署前回顾

### 之前遇到的问题
1. **动态导入失败**：已修复，改为静态导入
2. **环境变量配置**：统一使用 `ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET`
3. **数据库连接**：使用 `prisma db push` 同步schema
4. **PM2日志目录**：需要创建 `/var/log/podroom` 目录
5. **端口配置**：使用 `3010` 端口

### 关键改进
- ✅ 修复了动态导入问题（静态导入）
- ✅ 增强了错误处理和日志记录
- ✅ 优化了前端用户体验
- ✅ 增强了播客元数据提取
- ✅ 优化了报告生成（添加原话摘录）
- ✅ 改进了任务队列系统
- ✅ 更新了用户每日上传限制（从5个改为2个）

---

## 🛠️ 第一步：服务器环境检查

### 1.1 连接到服务器
```bash
ssh root@your-server-ip
# 或使用你的用户名
ssh your-username@your-server-ip
```

### 1.2 运行环境检查脚本

**重要**：首次部署前，先运行环境检查脚本，确保所有配置正确。

```bash
# 进入项目目录（如果已存在）
cd /opt/podroom

# 或者如果项目在其他位置，先克隆
cd /opt
git clone https://github.com/njumhw/podhome.git podroom
cd podroom

# 给检查脚本执行权限
chmod +x scripts/check-server-env.sh

# 运行检查脚本
./scripts/check-server-env.sh
```

**检查脚本会验证**：
- ✅ Node.js、pnpm、PM2 等工具是否安装
- ✅ `.env` 文件是否存在且配置正确
- ✅ 所有必需的环境变量是否设置
- ✅ 数据库连接是否正常
- ✅ PM2 配置是否正确
- ✅ 日志目录是否存在且有权限
- ✅ 磁盘空间和内存是否充足
- ✅ 网络连接是否正常

---

## 📝 第二步：配置环境变量

### 2.1 创建或检查 .env 文件

```bash
cd /opt/podroom

# 如果 .env 不存在，从模板创建
if [ ! -f .env ]; then
    cp env.example .env
    echo "已创建 .env 文件，请编辑配置"
fi

# 编辑 .env 文件
nano .env
# 或使用 vim
# vim .env
```

### 2.2 必需的环境变量配置

确保 `.env` 文件包含以下**必需**变量：

```bash
# ============================================
# 数据库配置（必需）
# ============================================
DATABASE_URL="postgresql://username:password@host:port/database"

# ============================================
# NextAuth 配置（必需）
# ============================================
NEXTAUTH_SECRET="your-super-secret-key-here"  # 生成随机字符串
NEXTAUTH_URL="https://your-domain.com"  # 你的生产环境域名

# ============================================
# 通义千问 API 配置（必需）
# ============================================
QWEN_API_KEY="your-qwen-api-key"

# ============================================
# 阿里云配置（ASR和OSS共用，必需）
# ============================================
ALIYUN_ACCESS_KEY_ID="your-access-key-id"
ALIYUN_ACCESS_KEY_SECRET="your-access-key-secret"
ALIYUN_ASR_APP_KEY="your-asr-app-key"  # 如果使用阿里云ASR

# ============================================
# 阿里云 OSS 配置（必需）
# ============================================
ALIYUN_OSS_BUCKET="your-bucket-name"
ALIYUN_OSS_REGION="oss-cn-hangzhou"  # 格式：oss-{region}

# ============================================
# Next.js 配置（必需）
# ============================================
NEXT_PUBLIC_BASE_URL="https://your-domain.com"  # 生产环境URL
PORT=3010  # 根据 ecosystem.config.js 配置

# ============================================
# Node.js 环境（必需）
# ============================================
NODE_ENV=production
```

### 2.3 生成 NEXTAUTH_SECRET

```bash
# 方法1：使用 openssl
openssl rand -base64 32

# 方法2：使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

将生成的字符串填入 `NEXTAUTH_SECRET`。

### 2.4 验证环境变量

```bash
# 再次运行检查脚本，确保所有配置正确
./scripts/check-server-env.sh
```

---

## 🗄️ 第三步：数据库配置

### 3.1 确保数据库可访问

```bash
# 测试数据库连接（如果安装了 psql）
psql "$DATABASE_URL" -c "SELECT 1;"
```

### 3.2 同步数据库 Schema

```bash
cd /opt/podroom

# 生成 Prisma 客户端
npx prisma generate

# 同步数据库 schema（不使用 migrate，使用 db push）
npx prisma db push
```

**注意**：`db push` 会直接同步 schema，不会创建 migration 文件。这是当前项目的配置方式。

---

## 📦 第四步：部署新代码

### 方案一：使用自动化部署脚本（推荐）

```bash
cd /opt/podroom

# 给部署脚本执行权限
chmod +x scripts/deploy.sh

# 执行部署（会自动备份、拉取代码、安装依赖、构建、重启）
sudo ./scripts/deploy.sh production main
```

**部署脚本会自动执行**：
1. ✅ 创建必要目录（备份目录、日志目录）
2. ✅ 备份当前版本
3. ✅ 拉取最新代码（从 GitHub）
4. ✅ 安装依赖（pnpm install）
5. ✅ 生成 Prisma 客户端
6. ✅ 构建应用（pnpm build）
7. ✅ 同步数据库 schema（prisma db push）
8. ✅ 重启应用（PM2）
9. ✅ 健康检查
10. ✅ 清理旧备份

### 方案二：手动部署

如果不想使用自动化脚本，可以手动执行：

```bash
cd /opt/podroom

# 1. 备份当前版本（可选但推荐）
cp -r . ../podroom-backup-$(date +%Y%m%d-%H%M%S)

# 2. 拉取最新代码
git fetch origin
git reset --hard origin/main
git clean -fd

# 3. 安装依赖
pnpm install --frozen-lockfile
# 或使用 npm
# npm install --frozen-lockfile

# 4. 生成 Prisma 客户端
npx prisma generate

# 5. 同步数据库 schema
npx prisma db push

# 6. 构建应用
pnpm build
# 或使用 npm
# npm run build

# 7. 重启应用
pm2 restart podroom
# 或如果应用未运行
# pm2 start ecosystem.config.js --env production
```

---

## 🔍 第五步：验证部署

### 5.1 检查应用状态

```bash
# 查看 PM2 状态
pm2 status

# 查看应用日志（最近50行）
pm2 logs podroom --lines 50

# 查看实时日志
pm2 logs podroom

# 检查应用是否响应
curl http://localhost:3010/api/health
```

### 5.2 检查功能

1. **访问首页**：打开浏览器访问 `https://your-domain.com`
2. **测试登录**：尝试登录或注册
3. **测试播客上传**：上传一个播客链接，验证每日限制为2个
4. **检查处理流程**：观察播客处理是否正常
5. **验证报告**：检查报告是否包含原话摘录

---

## 🛠️ 第六步：服务器设置检查

### 6.1 创建日志目录（如果不存在）

```bash
sudo mkdir -p /var/log/podroom
sudo chown $USER:$USER /var/log/podroom
```

### 6.2 检查 PM2 配置

```bash
# 查看 PM2 配置
cat ecosystem.config.js

# 确保 PM2 已保存配置
pm2 save

# 设置 PM2 开机自启（如果需要）
pm2 startup
# 然后执行输出的命令
```

### 6.3 检查防火墙

```bash
# 检查防火墙状态（Ubuntu/Debian）
sudo ufw status

# 如果需要，开放端口
sudo ufw allow 3010/tcp  # 应用端口（如果直接访问）
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
```

### 6.4 检查 Nginx 配置（如果使用反向代理）

```bash
# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 配置
sudo cat /etc/nginx/sites-available/podroom
# 或
sudo cat /etc/nginx/conf.d/podroom.conf

# 重启 Nginx
sudo systemctl restart nginx
```

**Nginx 配置示例**：
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 大文件上传/下载超时设置
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

---

## 🔄 日常更新流程

### 快速更新（小改动）

```bash
cd /opt/podroom
git pull
pnpm install
npx prisma generate
pnpm build
pm2 restart podroom
```

### 完整更新（大改动）

```bash
cd /opt/podroom
sudo ./scripts/deploy.sh production main
```

---

## 🚨 常见问题排查

### 问题1：应用启动失败

```bash
# 查看详细日志
pm2 logs podroom --err

# 检查环境变量
cd /opt/podroom
./scripts/check-server-env.sh

# 检查端口占用
sudo lsof -i :3010

# 检查 .env 文件
cat .env | grep -v "SECRET\|KEY\|PASSWORD"  # 不显示敏感信息
```

### 问题2：数据库连接失败

```bash
# 测试数据库连接
psql "$DATABASE_URL" -c "SELECT 1;"

# 检查 DATABASE_URL 格式
echo $DATABASE_URL  # 注意：不要在公共场合执行，会显示密码
```

### 问题3：构建失败

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

### 问题4：PM2 进程异常

```bash
# 停止所有进程
pm2 stop all

# 删除进程
pm2 delete podroom

# 重新启动
pm2 start ecosystem.config.js --env production
pm2 save
```

### 问题5：环境变量未生效

```bash
# 确保 .env 文件在项目根目录
ls -la /opt/podroom/.env

# 检查 PM2 环境变量
pm2 env podroom

# 重启 PM2（环境变量在启动时加载）
pm2 restart podroom
```

---

## 📊 监控和维护

### 查看应用状态

```bash
# PM2 状态
pm2 status

# PM2 监控
pm2 monit

# 查看日志
pm2 logs podroom --lines 100
```

### 查看系统资源

```bash
# CPU 和内存使用
top
# 或
htop

# 磁盘使用
df -h

# 磁盘空间详情
du -sh /opt/podroom/*
```

### 定期备份

```bash
# 备份数据库（如果使用本地PostgreSQL）
pg_dump podroom > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份代码（部署脚本已自动备份）
ls -la /opt/backups/podroom/
```

---

## ✅ 部署检查清单

部署前确认：
- [ ] 运行了 `./scripts/check-server-env.sh` 且所有检查通过
- [ ] `.env` 文件已正确配置所有必需变量
- [ ] `NEXTAUTH_SECRET` 已生成并设置
- [ ] `NEXT_PUBLIC_BASE_URL` 设置为实际域名
- [ ] 数据库连接正常
- [ ] 日志目录已创建且有权限
- [ ] PM2 配置正确

部署后验证：
- [ ] `pm2 status` 显示应用在线
- [ ] `curl http://localhost:3010/api/health` 返回正常
- [ ] 浏览器可以访问首页
- [ ] 可以登录/注册
- [ ] 可以上传播客（验证每日限制2个）
- [ ] 播客处理流程正常
- [ ] 报告包含原话摘录

---

## 📞 需要帮助？

如果遇到问题：
1. 运行 `./scripts/check-server-env.sh` 查看详细诊断
2. 查看 `pm2 logs podroom` 获取错误信息
3. 检查 `.env` 文件配置是否正确
4. 确认所有必需的环境变量都已设置

---

**祝部署顺利！** 🎉




