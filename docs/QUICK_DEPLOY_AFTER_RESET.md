# 服务器重置后快速上线指南

## 目标
快速恢复应用上线，包括：
- ✅ 应用在 3005 端口运行
- ✅ HTTPS 配置
- ✅ podcasttoinsight.top 域名访问

---

## 第一步：基础环境安装

### 1. SSH连接服务器

```bash
ssh root@47.117.77.211
```

### 2. 更新系统并安装基础工具

```bash
apt update && apt upgrade -y
apt install -y curl wget git build-essential ffmpeg
```

### 3. 安装Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 验证
node --version  # 应该显示 v20.x.x
npm --version
```

### 4. 安装pnpm和PM2

```bash
npm install -g pnpm pm2

# 验证
pnpm --version
pm2 --version
```

### 5. 添加Swap空间（重要！）

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 验证
free -h  # 应该看到 Swap 2.0Gi
```

---

## 第二步：克隆代码

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/njumhw/podhome.git podroom
cd podroom
```

---

## 第三步：配置环境变量

```bash
cd /opt/podroom
nano .env
```

**粘贴以下配置**（替换为你的实际值）：

```bash
# 数据库配置
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=prefer"

# NextAuth 配置
AUTH_SECRET="your-super-secret-key-here"
ADMIN_DASHBOARD_SECRET="your-admin-secret-here"

# 通义千问 API
QWEN_API_KEY="your-qwen-api-key"
QWEN_MODEL_NAME="qwen-max"
QWEN_ASR_MODEL="fun-asr"

# 阿里云配置
ALIYUN_ACCESS_KEY_ID="your-access-key-id"
ALIYUN_ACCESS_KEY_SECRET="your-access-key-secret"
ALIYUN_ASR_APP_KEY="your-asr-app-key"

# 阿里云 OSS
ALIYUN_OSS_BUCKET="your-bucket-name"
ALIYUN_OSS_REGION="oss-cn-hangzhou"

# Next.js 配置
NEXT_PUBLIC_BASE_URL="https://podcasttoinsight.top"
PORT=3005

# Node.js 环境
NODE_ENV=production

# MuleRun 配置
MULERUN_AGENT_KEY="ak_7I6ElD2_R1WIGcCKhheBFQAAAZsXEBf3bOwn9By-SMamwpzDUVct8m_fs7GwSEsTkSdPQrCoeK6MvLFfs3iZw6jWtr0-pKuA"
MULERUN_API_BASE_URL="https://api.mulerun.com"
MULERUN_QUERY_COST_CREDITS=100
MULERUN_SESSION_TIMEOUT_MINUTES=180
```

**生成随机密钥**：
```bash
openssl rand -base64 32  # 用于 AUTH_SECRET
openssl rand -base64 32  # 用于 ADMIN_DASHBOARD_SECRET
```

保存：`Ctrl+O` → `Enter` → `Ctrl+X`

---

## 第四步：安装依赖和配置数据库

```bash
cd /opt/podroom

# 安装依赖
pnpm install --frozen-lockfile

# 生成Prisma客户端
npx prisma generate

# 同步数据库
npx prisma db push
```

---

## 第五步：构建应用

```bash
cd /opt/podroom

# 清理缓存
rm -rf .next node_modules/.cache

# 构建（限制内存）
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

等待构建完成（约5-15分钟）

---

## 第六步：启动应用

```bash
cd /opt/podroom

# 创建日志目录
mkdir -p /var/log/podroom
chown root:root /var/log/podroom

# 启动应用
pm2 start ecosystem.config.js --env production

# 等待5秒
sleep 5

# 检查状态
pm2 list
pm2 logs podroom --lines 30 --nostream | grep -E "Local:|Network:"

# 应该显示 "Local: http://localhost:3005"

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
# 按提示执行输出的命令
```

---

## 第七步：配置Nginx和HTTPS

### 1. 安装Nginx和Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 2. 创建Nginx配置（先HTTP）

```bash
nano /etc/nginx/sites-available/podroom
```

**粘贴以下配置**：

```nginx
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    
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

保存：`Ctrl+O` → `Enter` → `Ctrl+X`

### 3. 启用配置

```bash
ln -s /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl start nginx
systemctl enable nginx
systemctl reload nginx
```

### 4. 配置防火墙

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3005/tcp
ufw reload
```

### 5. 配置阿里云安全组

在阿里云控制台：
1. ECS实例 → 安全组 → 配置规则
2. 添加入站规则：
   - **端口 80**，协议 **TCP**，源 **0.0.0.0/0**
   - **端口 443**，协议 **TCP**，源 **0.0.0.0/0**
   - **端口 3005**，协议 **TCP**，源 **0.0.0.0/0**

### 6. 获取SSL证书

```bash
certbot --nginx -d podcasttoinsight.top -d www.podcasttoinsight.top
```

按提示操作：
- 输入邮箱
- 同意服务条款（Y）
- 是否分享邮箱（可选）

Certbot会自动配置HTTPS并更新Nginx配置。

---

## 第八步：验证部署

### 1. 检查应用状态

```bash
# PM2状态
pm2 list
# 应该显示 online

# 检查端口
netstat -tlnp | grep :3005
# 应该显示 next-server 进程

# 测试本地访问
curl -I http://localhost:3005/home
# 应该返回 200 OK
```

### 2. 测试公网访问

```bash
# 测试HTTP（应该重定向到HTTPS）
curl -I http://podcasttoinsight.top/home

# 测试HTTPS
curl -I https://podcasttoinsight.top/home
# 应该返回 200 OK
```

### 3. 浏览器测试

访问：
- ✅ `https://podcasttoinsight.top/home`
- ✅ `https://podcasttoinsight.top/mulerun/preview`

---

## 快速检查清单

- [ ] Node.js 20.x 已安装
- [ ] pnpm 和 PM2 已安装
- [ ] Swap 2GB 已启用
- [ ] 代码已克隆
- [ ] `.env` 文件已配置
- [ ] 依赖已安装
- [ ] 数据库已同步
- [ ] 应用已构建成功
- [ ] PM2 应用状态为 `online`
- [ ] 应用在 3005 端口监听
- [ ] Nginx 已安装并运行
- [ ] SSL 证书已获取
- [ ] 防火墙已开放 80/443/3005
- [ ] 阿里云安全组已配置
- [ ] HTTPS 访问正常

---

## 常见问题

### 构建失败（内存不足）

```bash
# 检查swap
free -h

# 使用更小的内存限制
NODE_OPTIONS='--max-old-space-size=1024' pnpm build
```

### 应用无法启动

```bash
# 查看日志
pm2 logs podroom --err --lines 50

# 检查环境变量
pm2 env 0 | grep DATABASE_URL
```

### Nginx 502 Bad Gateway

```bash
# 检查应用是否运行
pm2 list

# 检查Nginx配置
cat /etc/nginx/sites-available/podroom | grep proxy_pass
# 应该显示：proxy_pass http://localhost:3005;
```

### SSL证书获取失败

```bash
# 检查DNS解析
nslookup podcasttoinsight.top
# 应该返回：47.117.77.211

# 检查80端口
lsof -i :80
```

---

## 一键执行脚本（可选）

如果需要，可以复制以下命令一次性执行（**不推荐，建议分步执行以便排查问题**）：

```bash
# 基础环境
apt update && apt upgrade -y && \
apt install -y curl wget git build-essential ffmpeg && \
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
apt-get install -y nodejs && \
npm install -g pnpm pm2 && \
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && \
echo '/swapfile none swap sw 0 0' >> /etc/fstab && \
mkdir -p /opt && cd /opt && \
git clone https://github.com/njumhw/podhome.git podroom && \
cd podroom && \
pnpm install --frozen-lockfile && \
npx prisma generate && \
npx prisma db push && \
NODE_OPTIONS='--max-old-space-size=1536' pnpm build && \
mkdir -p /var/log/podroom && \
pm2 start ecosystem.config.js --env production && \
pm2 save && \
apt install -y nginx certbot python3-certbot-nginx && \
ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 3005/tcp && ufw reload
```

**注意**：这个脚本不会配置 `.env` 文件和 Nginx 配置，这些需要手动完成。

---

完成以上步骤后，应用应该可以正常访问了！

