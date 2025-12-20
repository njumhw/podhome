# 服务器重置后快速上线步骤

## 📋 完整步骤（按顺序执行）

---

## 第一步：更新系统并安装基础工具

```bash
# 更新系统
apt update
apt upgrade -y

# 安装基础工具
apt install -y curl wget git build-essential ffmpeg
```

---

## 第二步：安装 Node.js 20.x

```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# 安装 Node.js
apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

**预期输出**：
- `node --version` 应该显示 `v20.x.x`
- `npm --version` 应该显示版本号

---

## 第三步：安装 pnpm 和 PM2

```bash
# 安装 pnpm
npm install -g pnpm

# 安装 PM2
npm install -g pm2

# 验证安装
pnpm --version
pm2 --version
```

---

## 第四步：添加 Swap 空间（重要！）

```bash
# 创建 2GB swap 文件
fallocate -l 2G /swapfile

# 设置权限
chmod 600 /swapfile

# 格式化为 swap
mkswap /swapfile

# 启用 swap
swapon /swapfile

# 永久启用（重启后仍然有效）
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 验证 swap 已启用
free -h
```

**预期输出**：
- `free -h` 应该显示 `Swap` 行有 `2.0Gi`

---

## 第五步：克隆代码

```bash
# 创建项目目录
mkdir -p /opt
cd /opt

# 克隆代码
git clone https://github.com/njumhw/podhome.git podroom

# 进入项目目录
cd podroom

# 确认代码已克隆
git log --oneline -1
```

---

## 第六步：配置环境变量

```bash
cd /opt/podroom

# 创建 .env 文件
nano .env
```

**在 nano 编辑器中粘贴以下内容**（替换为你的实际值）：

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

**生成随机密钥**（在另一个终端窗口执行）：
```bash
openssl rand -base64 32
```
将生成的字符串填入 `AUTH_SECRET` 和 `ADMIN_DASHBOARD_SECRET`。

**保存文件**：
- 按 `Ctrl+O` 保存
- 按 `Enter` 确认
- 按 `Ctrl+X` 退出

**验证环境变量**：
```bash
grep -E "DATABASE_URL|QWEN_API_KEY|ALIYUN_ACCESS_KEY_ID|MULERUN_AGENT_KEY" .env
```

---

## 第七步：安装依赖

```bash
cd /opt/podroom

# 安装依赖（可能需要5-10分钟）
pnpm install --frozen-lockfile
```

等待安装完成。

---

## 第八步：配置数据库

```bash
cd /opt/podroom

# 生成 Prisma 客户端
npx prisma generate

# 同步数据库 Schema
npx prisma db push
```

---

## 第九步：构建应用

```bash
cd /opt/podroom

# 清理缓存
rm -rf .next
rm -rf node_modules/.cache

# 检查资源
free -h
df -h

# 构建应用（限制内存使用，防止OOM）
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

**构建时间**：约5-15分钟，请耐心等待。

**如果构建成功**，应该看到：
```
✓ Compiled successfully
```

---

## 第十步：启动应用

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
```

**预期输出**：
- `pm2 list` 应该显示 `podroom` 状态为 `online`

**检查日志**：
```bash
pm2 logs podroom --lines 30 --nostream | grep -E "Local:|Network:"
```

**应该显示**：`Local: http://localhost:3005`

**保存PM2配置**：
```bash
pm2 save

# 设置开机自启
pm2 startup
# 按提示执行输出的命令（通常是 sudo env PATH=... pm2 startup systemd -u root --hp /root）
```

---

## 第十一步：配置 Nginx

### 1. 安装 Nginx

```bash
apt install -y nginx
```

### 2. 创建 Nginx 配置

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
# 创建符号链接
ln -s /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/

# 删除默认配置
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t
```

**如果测试通过**，应该看到：
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 4. 启动 Nginx

```bash
systemctl start nginx
systemctl enable nginx
systemctl reload nginx
```

---

## 第十二步：配置防火墙

```bash
# 开放端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3005/tcp

# 重新加载防火墙
ufw reload
```

---

## 第十三步：配置阿里云安全组

在阿里云控制台操作：

1. 登录阿里云控制台：https://ecs.console.aliyun.com
2. 找到你的 ECS 实例
3. 点击 **安全组** → **配置规则**
4. 点击 **添加安全组规则**
5. 添加以下规则：

   **规则1：HTTP**
   - 端口范围：`80/80`
   - 协议类型：`TCP`
   - 授权对象：`0.0.0.0/0`
   - 描述：`HTTP`

   **规则2：HTTPS**
   - 端口范围：`443/443`
   - 协议类型：`TCP`
   - 授权对象：`0.0.0.0/0`
   - 描述：`HTTPS`

   **规则3：应用端口（可选，用于直接访问）**
   - 端口范围：`3005/3005`
   - 协议类型：`TCP`
   - 授权对象：`0.0.0.0/0`
   - 描述：`Application`

6. 保存规则

---

## 第十四步：获取 SSL 证书

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书（会自动配置 HTTPS）
certbot --nginx -d podcasttoinsight.top -d www.podcasttoinsight.top
```

**按提示操作**：
1. 输入邮箱地址（用于证书到期提醒）
2. 同意服务条款：输入 `Y`
3. 是否分享邮箱：输入 `Y` 或 `N`（可选）
4. Certbot 会自动配置 HTTPS 并更新 Nginx 配置

**如果成功**，应该看到：
```
Successfully deployed certificate for podcasttoinsight.top
```

---

## 第十五步：验证部署

### 1. 检查应用状态

```bash
# PM2 状态
pm2 list

# 检查端口监听
netstat -tlnp | grep :3005

# 测试本地访问
curl -I http://localhost:3005/home
```

**预期输出**：
- `pm2 list` 显示 `podroom` 状态为 `online`
- `netstat` 显示有进程在监听 `:3005`
- `curl` 返回 `200 OK`

### 2. 测试公网访问

```bash
# 测试 HTTP（应该重定向到 HTTPS）
curl -I http://podcasttoinsight.top/home

# 测试 HTTPS
curl -I https://podcasttoinsight.top/home
```

**预期输出**：
- HTTP 应该返回 `301` 或 `302`（重定向）
- HTTPS 应该返回 `200 OK`

### 3. 浏览器测试

在浏览器中访问：
- ✅ `https://podcasttoinsight.top/home`
- ✅ `https://podcasttoinsight.top/mulerun/preview`

---

## 🔧 故障排查

### 问题1：构建失败（内存不足）

```bash
# 检查 swap
free -h

# 确保 swap 已启用
swapon --show

# 使用更小的内存限制重试
NODE_OPTIONS='--max-old-space-size=1024' pnpm build
```

### 问题2：应用无法启动

```bash
# 查看错误日志
pm2 logs podroom --err --lines 50

# 检查环境变量
pm2 env 0 | grep DATABASE_URL

# 检查端口是否被占用
netstat -tlnp | grep :3005
```

### 问题3：Nginx 502 Bad Gateway

```bash
# 检查应用是否运行
pm2 list

# 检查 Nginx 配置中的端口
cat /etc/nginx/sites-available/podroom | grep proxy_pass
# 应该显示：proxy_pass http://localhost:3005;

# 检查 Nginx 错误日志
tail -50 /var/log/nginx/error.log
```

### 问题4：SSL 证书获取失败

```bash
# 检查 DNS 解析
nslookup podcasttoinsight.top
dig podcasttoinsight.top +short
# 应该返回：47.117.77.211

# 检查 80 端口是否被占用
lsof -i :80

# 检查防火墙
ufw status
```

---

## ✅ 完成检查清单

部署完成后，确认以下项目：

- [ ] Node.js 20.x 已安装
- [ ] pnpm 和 PM2 已安装
- [ ] Swap 2GB 已启用
- [ ] 代码已克隆到 `/opt/podroom`
- [ ] `.env` 文件已配置所有必需变量
- [ ] 依赖已安装
- [ ] Prisma 客户端已生成
- [ ] 数据库 Schema 已同步
- [ ] 应用已成功构建
- [ ] PM2 应用状态为 `online`
- [ ] 应用在 3005 端口监听
- [ ] Nginx 已安装并运行
- [ ] Nginx 配置已创建并启用
- [ ] 防火墙已开放 80/443/3005
- [ ] 阿里云安全组已配置
- [ ] SSL 证书已获取
- [ ] HTTPS 访问正常

---

## 📝 重要提示

1. **环境变量**：确保 `.env` 文件中所有必需变量都已配置，特别是：
   - `DATABASE_URL`
   - `QWEN_API_KEY`
   - `ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET`
   - `MULERUN_AGENT_KEY`

2. **构建时间**：首次构建可能需要 10-15 分钟，请耐心等待，不要中断。

3. **Swap 空间**：必须添加，否则构建可能因内存不足而失败。

4. **SSL 证书**：Certbot 会自动配置 HTTPS，无需手动修改 Nginx 配置。

5. **域名 DNS**：确保 `podcasttoinsight.top` 的 A 记录指向服务器 IP `47.117.77.211`。

---

完成以上步骤后，应用应该可以正常访问了！🎉

