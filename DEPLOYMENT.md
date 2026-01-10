# 部署指南

## 构建错误检查

当前构建失败是因为**网络问题**（无法连接 Google Fonts），不是代码错误。在服务器上构建时，如果网络正常，应该不会有这个问题。

如果服务器也无法访问 Google Fonts，可以考虑：
1. 使用代理
2. 或者将字体文件本地化

## 部署方式

项目支持两种部署方式：
1. **Docker 部署**（推荐）
2. **PM2 部署**

---

## 方式一：Docker 部署（推荐）

### 前置要求
- Docker 和 Docker Compose 已安装
- 服务器可以访问互联网（用于构建时下载依赖）

### 部署步骤

#### 1. 准备环境变量

在服务器上创建 `.env` 文件（或使用现有的环境变量配置）：

```bash
# 数据库
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Next.js
NODE_ENV=production
PORT=3005
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-domain.com

# 通义千问
QWEN_API_KEY=your-api-key
QWEN_MODEL_NAME=qwen3-max

# 阿里云 ASR
ALIYUN_ASR_ACCESS_KEY_ID=your-key-id
ALIYUN_ASR_ACCESS_KEY_SECRET=your-secret
ALIYUN_ASR_ENDPOINT=https://nls-gateway.cn-shanghai.aliyuncs.com

# 阿里云 OSS
ALIYUN_OSS_ACCESS_KEY_ID=your-key-id
ALIYUN_OSS_ACCESS_KEY_SECRET=your-secret
ALIYUN_OSS_BUCKET=your-bucket-name
ALIYUN_OSS_REGION=oss-cn-shanghai
ALIYUN_OSS_ENDPOINT=https://oss-cn-shanghai.aliyuncs.com

# 其他配置
# ... 其他环境变量
```

#### 2. 构建 Docker 镜像

```bash
# 在项目根目录执行
docker build -t podroom:latest .
```

#### 3. 运行容器

```bash
# 使用 Docker 运行
docker run -d \
  --name podroom \
  -p 3005:3000 \
  --env-file .env \
  --restart unless-stopped \
  podroom:latest
```

或者使用 Docker Compose（推荐）：

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  podroom:
    build: .
    container_name: podroom
    ports:
      - "3005:3000"
    env_file:
      - .env
    restart: unless-stopped
    volumes:
      # 如果需要持久化日志
      - ./logs:/var/log/podroom
```

然后运行：

```bash
docker-compose up -d
```

#### 4. 查看日志

```bash
# Docker 日志
docker logs -f podroom

# 或 Docker Compose
docker-compose logs -f
```

#### 5. 更新部署

```bash
# 停止旧容器
docker stop podroom
docker rm podroom

# 重新构建镜像（如果有代码更新）
docker build -t podroom:latest .

# 启动新容器
docker run -d \
  --name podroom \
  -p 3005:3000 \
  --env-file .env \
  --restart unless-stopped \
  podroom:latest
```

---

## 方式二：PM2 部署

### 前置要求
- Node.js 18+ 已安装
- pnpm 已安装
- PM2 已安装：`npm install -g pm2`

### 部署步骤

#### 1. 在服务器上克隆/更新代码

```bash
# 如果还没有代码，先克隆
git clone <your-repo-url> /opt/podroom
cd /opt/podroom

# 如果已有代码，更新
cd /opt/podroom
git pull origin main  # 或你的主分支名
```

#### 2. 安装依赖

```bash
pnpm install
```

#### 3. 生成 Prisma 客户端

```bash
pnpm prisma generate
```

#### 4. 构建项目

```bash
pnpm build
```

#### 5. 准备环境变量

确保 `/opt/podroom/.env` 文件存在并包含所有必要的环境变量（参考上面的环境变量列表）。

#### 6. 创建日志目录

```bash
sudo mkdir -p /var/log/podroom
sudo chown -R $USER:$USER /var/log/podroom
```

#### 7. 启动 PM2

```bash
# 使用 ecosystem.config.js 启动
pm2 start ecosystem.config.js --env production

# 或直接启动
pm2 start npm --name podroom -- start
```

#### 8. 设置 PM2 开机自启

```bash
pm2 save
pm2 startup
```

#### 9. 查看状态和日志

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs podroom

# 查看详细信息
pm2 info podroom
```

#### 10. 更新部署

```bash
cd /opt/podroom

# 拉取最新代码
git pull origin main

# 安装新依赖（如果有）
pnpm install

# 重新生成 Prisma 客户端
pnpm prisma generate

# 重新构建
pnpm build

# 重启 PM2
pm2 restart podroom
```

---

## 数据库迁移

如果数据库结构有变化，需要执行迁移：

```bash
# 方式一：使用 Prisma Migrate（推荐）
pnpm prisma migrate deploy

# 方式二：使用 db push（开发环境）
pnpm prisma db push
```

**注意**：在生产环境使用 `prisma migrate deploy`，不要使用 `db push`。

---

## 健康检查

部署后，检查服务是否正常运行：

```bash
# 检查端口是否监听
netstat -tlnp | grep 3005

# 或使用 curl 测试
curl http://localhost:3005

# 检查 PM2 状态（如果使用 PM2）
pm2 status
```

---

## 反向代理配置（Nginx）

如果需要使用 Nginx 作为反向代理，配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 常见问题

### 1. 构建时无法连接 Google Fonts

**问题**：构建失败，提示无法连接 Google Fonts

**解决方案**：
- 确保服务器可以访问互联网
- 或者使用代理：在构建时设置 `HTTP_PROXY` 和 `HTTPS_PROXY` 环境变量
- 或者将字体本地化（需要修改代码）

### 2. 数据库连接失败

**问题**：应用启动后无法连接数据库

**解决方案**：
- 检查 `DATABASE_URL` 环境变量是否正确
- 检查数据库服务器是否可访问
- 检查防火墙设置

### 3. Prisma 客户端未生成

**问题**：运行时提示 Prisma Client 未找到

**解决方案**：
```bash
pnpm prisma generate
```

### 4. 端口被占用

**问题**：端口 3005 已被占用

**解决方案**：
- 修改 `ecosystem.config.js` 中的 `PORT` 配置
- 或修改 Docker 的端口映射

---

## 监控和维护

### 查看日志

**Docker 方式**：
```bash
docker logs -f podroom
```

**PM2 方式**：
```bash
pm2 logs podroom
```

### 重启服务

**Docker 方式**：
```bash
docker restart podroom
```

**PM2 方式**：
```bash
pm2 restart podroom
```

### 停止服务

**Docker 方式**：
```bash
docker stop podroom
```

**PM2 方式**：
```bash
pm2 stop podroom
```

---

## 安全建议

1. **环境变量安全**：不要将 `.env` 文件提交到 Git
2. **HTTPS**：生产环境使用 HTTPS（通过 Nginx 配置 SSL）
3. **防火墙**：只开放必要的端口
4. **定期更新**：定期更新依赖和系统包
5. **备份**：定期备份数据库

---

## 快速部署检查清单

- [ ] 环境变量已配置（`.env` 文件）
- [ ] 数据库已创建并可访问
- [ ] 依赖已安装（`pnpm install`）
- [ ] Prisma 客户端已生成（`pnpm prisma generate`）
- [ ] 项目已构建（`pnpm build`）
- [ ] 服务已启动（Docker 或 PM2）
- [ ] 端口已开放（3005）
- [ ] 日志正常（无错误）
- [ ] 健康检查通过（可以访问首页）
