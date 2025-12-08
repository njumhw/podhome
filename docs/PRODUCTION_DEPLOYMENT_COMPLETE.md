# 生产模式完整部署指南

## 前提条件

- 服务器已重置
- 已备份 `.env` 文件内容
- 有 SSH 访问权限

---

## 第一步：初始服务器配置

### 1. SSH连接到服务器

```bash
ssh root@your-server-ip
```

### 2. 更新系统并安装基础工具

```bash
# 更新系统
apt update && apt upgrade -y

# 安装基础工具
apt install -y curl wget git build-essential
```

### 3. 安装Node.js 20.x

```bash
# 安装Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 验证安装
node --version  # 应该显示 v20.x.x
npm --version
```

### 4. 安装pnpm

```bash
npm install -g pnpm

# 验证安装
pnpm --version  # 应该显示 10.x.x
```

### 5. 安装PM2

```bash
npm install -g pm2

# 验证安装
pm2 --version

# 设置PM2开机自启
pm2 startup
# 按提示执行输出的命令（通常是 sudo env PATH=... pm2 startup systemd -u root --hp /root）
```

### 6. 安装FFmpeg（如果需要）

```bash
apt install -y ffmpeg

# 验证安装
ffmpeg -version
```

---

## 第二步：添加Swap空间（关键！）

这是确保构建成功的关键步骤：

```bash
# 创建2GB swap文件
fallocate -l 2G /swapfile

# 设置权限
chmod 600 /swapfile

# 格式化为swap
mkswap /swapfile

# 启用swap
swapon /swapfile

# 验证swap已启用
free -h
# 应该看到 Swap 行显示 2.0Gi

# 永久启用（重启后仍然有效）
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 验证配置
swapon --show
```

---

## 第三步：克隆代码并配置

### 1. 创建项目目录

```bash
mkdir -p /opt
cd /opt
```

### 2. 克隆代码

```bash
git clone https://github.com/njumhw/podhome.git podroom
cd podroom

# 确认代码版本
git log --oneline -1
# 应该显示：0b468af fix: 修复播客处理链路问题
```

### 3. 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 4. 配置环境变量

```bash
# 创建.env文件
nano /opt/podroom/.env
```

**粘贴之前备份的 `.env` 文件内容**，确保包含：
- `DATABASE_URL`
- `QWEN_API_KEY`
- `ALIYUN_OSS_BUCKET`
- `ALIYUN_OSS_REGION`
- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `NEXT_PUBLIC_BASE_URL`
- `PORT=3005`（确保端口是3005）

保存：`Ctrl+O`，`Enter`，`Ctrl+X`

### 5. 验证环境变量

```bash
# 检查关键环境变量
grep -E "DATABASE_URL|QWEN_API_KEY|PORT" /opt/podroom/.env
```

---

## 第四步：数据库配置

### 1. 生成Prisma客户端

```bash
cd /opt/podroom
npx prisma generate
```

### 2. 同步数据库Schema

```bash
npx prisma db push
```

---

## 第五步：构建应用（关键步骤）

### 1. 清理缓存

```bash
cd /opt/podroom
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo
```

### 2. 检查资源

```bash
# 检查内存和swap
free -h

# 检查磁盘空间
df -h

# 确保有足够资源：
# - 内存：至少500MB可用
# - Swap：2GB已启用
# - 磁盘：至少5GB可用
```

### 3. 构建应用（使用限制内存的方式）

```bash
cd /opt/podroom

# 使用限制内存的方式构建，避免OOM
NODE_OPTIONS='--max-old-space-size=2048' pnpm build
```

**构建过程**：
- Prisma生成：约1-2秒
- Next.js构建：约10-20分钟（取决于服务器性能）
- 如果卡住超过30分钟，按Ctrl+C中断，检查错误

### 4. 验证构建成功

构建成功后应该看到：
```
✓ Compiled successfully
```

检查构建文件：
```bash
# 检查BUILD_ID文件（构建成功的标志）
ls -la .next/BUILD_ID

# 应该显示文件存在
```

### 5. 如果构建失败

**检查错误**：
```bash
# 查看构建日志的最后部分
# 通常错误信息会在最后显示
```

**常见问题**：
- 内存不足：确保swap已启用，使用更小的内存限制 `NODE_OPTIONS='--max-old-space-size=1536'`
- 磁盘空间不足：清理空间 `df -h`，删除不需要的文件
- 依赖问题：重新安装 `rm -rf node_modules && pnpm install --frozen-lockfile`

**如果构建还是失败**：
```bash
# 清理并重新安装依赖
rm -rf node_modules
pnpm install --frozen-lockfile

# 再次尝试构建
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

---

## 第六步：启动应用（生产模式）

### 1. 使用PM2启动生产模式

```bash
cd /opt/podroom

# 使用PM2启动生产模式
pm2 start ecosystem.config.js --env production

# 查看状态
pm2 list

# 查看日志
pm2 logs podroom --lines 30

# 保存PM2配置（开机自启）
pm2 save
```

### 2. 验证应用运行

```bash
# 测试本地访问
curl -I http://localhost:3005/home

# 应该返回 200 OK

# 检查端口是否在监听
netstat -tlnp | grep 3005
# 或
lsof -i :3005
```

---

## 第七步：配置防火墙和安全组

### 1. 配置防火墙

```bash
# 安装ufw（如果还没有）
apt install -y ufw

# 开放必要端口
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 3005/tcp # 应用端口（如果直接访问）

# 启用防火墙
ufw enable
ufw status
```

### 2. 配置阿里云安全组

在阿里云控制台：
1. 进入ECS实例详情
2. 点击“安全组”标签
3. 点击“配置规则”
4. 添加入站规则：
   - **端口范围**：`3005/3005`
   - **协议类型**：`TCP`
   - **授权对象**：`0.0.0.0/0`（或你的IP）
   - **描述**：`Podroom应用端口`
5. 同样添加 `80/80` 和 `443/443` 端口（如果使用HTTPS）

---

## 第八步：配置Nginx反向代理（如果使用HTTPS）

### 1. 安装Nginx

```bash
apt install -y nginx
```

### 2. 配置Nginx

```bash
nano /etc/nginx/sites-available/podroom
```

**配置内容**（替换`podcasttoinsight.top`为你的域名）：

```nginx
# HTTP重定向到HTTPS
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;

    # 用于Let's Encrypt验证
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # 其他请求重定向到HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS配置
server {
    listen 443 ssl http2;
    server_name podcasttoinsight.top www.podcasttoinsight.top;

    # SSL证书（Certbot会自动配置）
    ssl_certificate /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/podcasttoinsight.top/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 反向代理到Next.js应用（端口3005）
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
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 3. 启用配置

```bash
# 创建符号链接
ln -s /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/

# 删除默认配置
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 如果测试通过，启动/重载Nginx
systemctl start nginx
systemctl enable nginx
systemctl reload nginx
```

### 4. 申请SSL证书

```bash
# 安装Certbot
apt install -y certbot python3-certbot-nginx

# 申请证书（替换为你的域名）
certbot --nginx -d podcasttoinsight.top -d www.podcasttoinsight.top

# 按提示操作：
# 1. 输入邮箱地址
# 2. 同意服务条款
# 3. 选择是否分享邮箱（可选）
# 4. Certbot会自动配置Nginx
```

---

## 第九步：验证部署

### 1. 检查应用状态

```bash
# PM2状态
pm2 list
# 应该显示 podroom 状态为 online

# 查看日志
pm2 logs podroom --lines 20
# 应该看到应用正常启动的日志

# 查看应用信息
pm2 info podroom
```

### 2. 测试访问

```bash
# 测试本地访问
curl -I http://localhost:3005/home
# 应该返回 200 OK

# 测试HTTPS访问（如果配置了）
curl -I https://podcasttoinsight.top/home
# 应该返回 200 OK

# 测试外网访问（如果直接访问IP）
curl -I http://47.117.77.211:3005/home
# 应该返回 200 OK（需要安全组开放端口）
```

### 3. 检查功能

- 访问首页：`https://podcasttoinsight.top/home` 或 `http://47.117.77.211:3005/home`
- 测试播客处理功能
- 检查数据库连接

---

## 故障排查

### 问题1：构建卡住

**解决方案**：
1. 检查内存和swap：`free -h`
2. 确保swap已启用：`swapon --show`
3. 使用更小的内存限制：`NODE_OPTIONS='--max-old-space-size=1536' pnpm build`
4. 如果还是卡住，等待更长时间（swap很慢，但应该能完成）

### 问题2：应用无法启动

**检查**：
```bash
# 查看PM2日志
pm2 logs podroom --err --lines 50

# 检查端口是否被占用
netstat -tlnp | grep 3005

# 检查环境变量
pm2 env podroom
```

### 问题3：502错误

**检查**：
```bash
# 检查应用是否运行
pm2 list

# 检查Nginx配置
cat /etc/nginx/sites-available/podroom | grep proxy_pass
# 应该看到：proxy_pass http://localhost:3005;

# 检查Nginx错误日志
tail -20 /var/log/nginx/error.log
```

### 问题4：数据库连接失败

**检查**：
```bash
# 测试数据库连接
npx prisma db push

# 检查环境变量
grep DATABASE_URL /opt/podroom/.env
```

---

## 维护建议

### 更新代码

```bash
cd /opt/podroom

# 拉取最新代码
git pull origin main

# 安装依赖（如果有更新）
pnpm install --frozen-lockfile

# 重新构建
NODE_OPTIONS='--max-old-space-size=2048' pnpm build

# 重启应用
pm2 restart podroom
```

### 定期检查

```bash
# 检查磁盘空间
df -h

# 检查内存使用
free -h

# 检查PM2状态
pm2 list

# 查看应用日志
pm2 logs podroom --lines 50
```

---

## 总结

重置服务器后的完整流程：
1. ✅ 安装基础环境（Node.js, pnpm, PM2）
2. ✅ 添加Swap空间（2GB）
3. ✅ 克隆代码并配置环境变量
4. ✅ 构建应用（限制内存使用）
5. ✅ 启动应用（生产模式）
6. ✅ 配置防火墙和安全组
7. ✅ 配置Nginx和HTTPS（可选）
8. ✅ 验证部署

**关键点**：
- Swap空间是构建成功的关键
- 使用 `NODE_OPTIONS='--max-old-space-size=2048'` 限制内存
- 如果构建卡住，等待更长时间（swap很慢）
- 确保Nginx配置的端口是3005

