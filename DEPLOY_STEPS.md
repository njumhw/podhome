# 🚀 阿里云服务器部署步骤（最新版）

## 📋 部署前准备

### 1. 本地代码检查（已完成 ✅）
- ✅ TypeScript 编译错误已修复
- ✅ 代码已通过类型检查
- ✅ Cookie Secure 设置已修复（生产环境自动使用 HTTPS）

### 2. 提交代码到 Git（如果还没提交）

```bash
# 在本地项目目录
cd /Users/maoweihao/cursor/Ear/podroom

# 检查修改
git status

# 添加所有修改
git add .

# 提交
git commit -m "修复编译错误，准备部署"

# 推送到远程仓库
git push origin main
# 或
git push origin master
```

---

## 🖥️ 服务器端操作步骤

### 第一步：连接到服务器

```bash
ssh root@your-server-ip
# 或使用你的用户名
ssh your-username@your-server-ip
```

### 第二步：进入项目目录

```bash
cd /opt/podroom
```

**如果项目目录不存在，先克隆仓库：**
```bash
cd /opt
git clone https://github.com/njumhw/podhome.git podroom
# 或你的实际仓库地址
cd podroom
```

### 第三步：拉取最新代码

```bash
# 确保在正确的分支
git fetch origin
git checkout main  # 或 master，根据你的主分支名称

# 拉取最新代码
git pull origin main
# 或
git pull origin master
```

### 第四步：检查环境变量

```bash
# 检查 .env 文件是否存在
ls -la .env

# 如果不存在，从模板创建
if [ ! -f .env ]; then
    cp env.example .env
    echo "⚠️  已创建 .env 文件，请编辑配置"
    nano .env  # 或 vim .env
fi
```

**必需的环境变量（确保都已配置）：**
```bash
# 数据库
DATABASE_URL="postgresql://postgres:mwh271678@db.jshrscnivfjcqfsguaic.supabase.co:5432/postgres?sslmode=prefer"

# 认证密钥（必须设置，不能为空）
AUTH_SECRET="your-secret-key-here"
ADMIN_DASHBOARD_SECRET="your-admin-secret-here"

# 通义千问 API
QWEN_API_KEY="your-qwen-api-key"

# 阿里云配置
ALIYUN_ACCESS_KEY_ID="your-access-key-id"
ALIYUN_ACCESS_KEY_SECRET="your-access-key-secret"
ALIYUN_ASR_APP_KEY="your-asr-app-key"  # 如果使用

# 阿里云 OSS
ALIYUN_OSS_BUCKET="your-bucket-name"
ALIYUN_OSS_REGION="oss-cn-hangzhou"  # 格式：oss-{region}

# Next.js 配置
NEXT_PUBLIC_BASE_URL="http://47.117.77.211:3005"  # 或你的实际域名
PORT=3005  # 根据 ecosystem.config.js，当前是 3005

# 环境标识
NODE_ENV=production
```

### 第五步：运行环境检查脚本（推荐）

```bash
# 给脚本执行权限
chmod +x scripts/check-server-env.sh

# 运行检查
./scripts/check-server-env.sh
```

**检查脚本会验证**：
- Node.js、pnpm、PM2 是否安装
- 环境变量是否配置正确
- 数据库连接是否正常
- 日志目录是否存在

### 第六步：安装/更新依赖

```bash
# 使用 pnpm（推荐）
pnpm install --frozen-lockfile

# 或使用 npm
npm install --frozen-lockfile
```

### 第七步：生成 Prisma 客户端

```bash
npx prisma generate
```

### 第八步：同步数据库 Schema

```bash
# 同步数据库结构（不使用 migrate，使用 db push）
npx prisma db push
```

**注意**：这会直接同步 schema，不会创建 migration 文件。

### 第九步：构建应用

```bash
# 构建 Next.js 应用
pnpm build
# 或
npm run build
```

**如果构建失败**：
```bash
# 清理缓存
rm -rf .next
rm -rf node_modules/.cache

# 重新安装依赖
rm -rf node_modules
pnpm install

# 重新构建
pnpm build
```

### 第十步：创建日志目录（如果不存在）

```bash
sudo mkdir -p /var/log/podroom
sudo chown $USER:$USER /var/log/podroom
# 或
sudo chown root:root /var/log/podroom
```

### 第十一步：启动/重启应用

#### 如果应用已经在运行（使用 PM2）

```bash
# 查看当前状态
pm2 status

# 重启应用
pm2 restart podroom

# 或完全重启
pm2 stop podroom
pm2 start ecosystem.config.js --env production
```

#### 如果应用未运行

```bash
# 启动应用
pm2 start ecosystem.config.js --env production

# 保存 PM2 配置
pm2 save

# 设置开机自启（如果需要）
pm2 startup
# 然后执行输出的命令
```

### 第十二步：验证部署

```bash
# 1. 检查 PM2 状态
pm2 status

# 2. 查看应用日志（最近50行）
pm2 logs podroom --lines 50

# 3. 查看实时日志
pm2 logs podroom

# 4. 检查应用是否响应（如果配置了健康检查端点）
curl http://localhost:3005/api/health

# 5. 检查端口是否监听
sudo lsof -i :3005
# 或
netstat -tlnp | grep 3005
```

### 第十三步：功能测试

1. **访问首页**：打开浏览器访问 `http://47.117.77.211:3005/home`
2. **测试登录**：尝试登录或注册
3. **测试播客列表**：检查最新/最热/收藏列表是否正常加载
4. **测试播客详情**：打开一个播客详情页
5. **测试上传**：尝试上传一个播客链接（验证每日限制2个）

---

## 🔄 快速更新流程（日常使用）

如果只是代码更新，可以简化流程：

```bash
cd /opt/podroom

# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖（如果有新依赖）
pnpm install

# 3. 生成 Prisma 客户端
npx prisma generate

# 4. 构建应用
pnpm build

# 5. 同步数据库（如果有 schema 变更）
npx prisma db push

# 6. 重启应用
pm2 restart podroom

# 7. 查看日志确认
pm2 logs podroom --lines 20
```

---

## 🚨 常见问题排查

### 问题1：构建失败

```bash
# 查看构建错误
pnpm build 2>&1 | tee build.log

# 清理后重试
rm -rf .next node_modules/.cache
pnpm install
pnpm build
```

### 问题2：应用启动失败

```bash
# 查看详细错误日志
pm2 logs podroom --err --lines 100

# 检查环境变量
pm2 env podroom

# 检查端口占用
sudo lsof -i :3005

# 手动测试启动
cd /opt/podroom
NODE_ENV=production node server.js
```

### 问题3：数据库连接失败

```bash
# 测试数据库连接
psql "$DATABASE_URL" -c "SELECT 1;"

# 检查 DATABASE_URL 格式
echo $DATABASE_URL | sed 's/:[^:]*@/:***@/'  # 隐藏密码显示
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
# 确保 .env 文件存在
ls -la /opt/podroom/.env

# 检查 PM2 加载的环境变量
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

# PM2 监控面板
pm2 monit

# 查看日志
pm2 logs podroom --lines 100

# 查看错误日志
pm2 logs podroom --err
```

### 查看系统资源

```bash
# CPU 和内存
top
# 或
htop

# 磁盘使用
df -h

# 项目目录大小
du -sh /opt/podroom/*
```

---

## ✅ 部署检查清单

### 部署前
- [ ] 代码已提交并推送到 Git
- [ ] 已连接到服务器
- [ ] 已进入项目目录 `/opt/podroom`
- [ ] 已拉取最新代码
- [ ] `.env` 文件已配置所有必需变量
- [ ] 运行了环境检查脚本（可选但推荐）

### 部署中
- [ ] 依赖安装成功
- [ ] Prisma 客户端生成成功
- [ ] 数据库 schema 同步成功
- [ ] 应用构建成功（无错误）
- [ ] 日志目录已创建

### 部署后
- [ ] PM2 状态显示应用在线
- [ ] 应用日志无错误
- [ ] 可以访问首页
- [ ] 可以登录/注册
- [ ] 播客列表正常加载
- [ ] 播客详情页正常
- [ ] 上传功能正常（验证限制）

---

## 📝 重要提示

1. **端口配置**：当前 `ecosystem.config.js` 中配置的端口是 `3005`，不是 `3010`
2. **环境变量**：确保 `AUTH_SECRET` 和 `ADMIN_DASHBOARD_SECRET` 已设置且不为空
3. **数据库**：使用 `prisma db push` 而不是 `prisma migrate`
4. **构建**：如果构建失败，先清理缓存再重试
5. **日志**：部署后立即查看日志，确认无错误

---

**祝部署顺利！** 🎉

