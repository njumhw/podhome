# 完整服务器重置和配置指南

## 📋 目录

1. [服务器重置](#第一步服务器重置)
2. [基础环境安装](#第二步基础环境安装)
3. [代码克隆和配置](#第三步代码克隆和配置)
4. [环境变量配置](#第四步环境变量配置)
5. [数据库配置](#第五步数据库配置)
6. [构建和启动应用](#第六步构建和启动应用)
7. [Nginx和HTTPS配置](#第七步nginx和https配置)
8. [域名配置](#第八步域名配置)
9. [验证部署](#第九步验证部署)

---

## 第一步：服务器重置

### 在阿里云控制台操作：

1. 登录阿里云控制台：https://ecs.console.aliyun.com
2. 找到你的ECS实例
3. 点击 **"更多"** → **"重置实例"** 或 **"更换系统盘"**
4. **重要**：选择 **"保留数据盘"**（如果数据盘有重要数据）
5. 选择系统镜像：**Ubuntu 22.04 LTS** 或 **Ubuntu 24.04 LTS**
6. 设置root密码或SSH密钥
7. 确认重置

### 等待重置完成（通常5-10分钟）

---

## 第二步：基础环境安装

### 1. SSH连接到服务器

```bash
ssh root@47.117.77.211
# 或使用你的实际IP
```

### 2. 更新系统并安装基础工具

```bash
# 更新系统
apt update && apt upgrade -y

# 安装基础工具
apt install -y curl wget git build-essential ffmpeg
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

# 设置PM2开机自启（稍后执行，先跳过）
# pm2 startup
```

### 6. 添加Swap空间（重要！防止构建时OOM）

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

## 第三步：代码克隆和配置

### 1. 创建项目目录

```bash
mkdir -p /opt
cd /opt
```

### 2. 克隆代码

```bash
# 克隆代码
git clone https://github.com/njumhw/podhome.git podroom
cd podroom

# 确认代码已克隆
git log --oneline -1
```

### 3. 安装依赖

```bash
# 安装依赖（可能需要5-10分钟）
pnpm install --frozen-lockfile
```

---

## 第四步：环境变量配置

### 1. 创建.env文件

```bash
cd /opt/podroom
nano .env
```

### 2. 配置所有必需的环境变量

**完整的环境变量配置模板**（请替换为你的实际值）：

```bash
# ============================================
# 数据库配置（必需）
# ============================================
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=prefer"

# ============================================
# NextAuth 配置（必需）
# ============================================
AUTH_SECRET="your-super-secret-key-here"  # 生成随机字符串
ADMIN_DASHBOARD_SECRET="your-admin-secret-here"  # 生成随机字符串

# ============================================
# 通义千问 API 配置（必需）
# ============================================
QWEN_API_KEY="your-qwen-api-key"
QWEN_MODEL_NAME="qwen-max"
QWEN_ASR_MODEL="fun-asr"

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
NEXT_PUBLIC_BASE_URL="https://podcasttoinsight.top"  # 你的生产环境域名
PORT=3005  # 应用端口

# ============================================
# Node.js 环境（必需）
# ============================================
NODE_ENV=production

# ============================================
# MuleRun 配置（必需）
# ============================================
MULERUN_AGENT_KEY="ak_7I6ElD2_R1WIGcCKhheBFQAAAZsXEBf3bOwn9By-SMamwpzDUVct8m_fs7GwSEsTkSdPQrCoeK6MvLFfs3iZw6jWtr0-pKuA"
MULERUN_API_BASE_URL="https://api.mulerun.com"
MULERUN_QUERY_COST_CREDITS=100  # 每个播客处理的成本（credits）
MULERUN_SESSION_TIMEOUT_MINUTES=180  # 会话超时时间（3小时）
```

### 3. 生成随机密钥

```bash
# 生成 AUTH_SECRET
openssl rand -base64 32

# 生成 ADMIN_DASHBOARD_SECRET
openssl rand -base64 32
```

将生成的字符串填入对应的环境变量。

### 4. 保存文件

在nano编辑器中：
- 按 `Ctrl+O` 保存
- 按 `Enter` 确认
- 按 `Ctrl+X` 退出

### 5. 验证环境变量

```bash
# 检查关键环境变量是否已配置
grep -E "DATABASE_URL|QWEN_API_KEY|ALIYUN_ACCESS_KEY_ID|MULERUN_AGENT_KEY" .env
```

---

## 第五步：数据库配置

### 1. 生成Prisma客户端

```bash
cd /opt/podroom
npx prisma generate
```

### 2. 同步数据库Schema

```bash
# 同步数据库结构（不使用 migrate，使用 db push）
npx prisma db push

# 如果提示数据库不为空，这是正常的，继续即可
```

---

## 第六步：构建和启动应用

### 1. 清理缓存

```bash
cd /opt/podroom
rm -rf .next
rm -rf node_modules/.cache
```

### 2. 检查资源

```bash
# 检查内存和swap
free -h
# 确保 Swap 显示 2.0Gi

# 检查磁盘空间
df -h
# 确保有至少5GB可用空间
```

### 3. 构建应用（限制内存使用）

```bash
# 限制Node.js内存使用，避免OOM
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

**构建过程**：
- Prisma生成：约1-2秒
- Next.js构建：约5-15分钟（取决于服务器性能）
- 如果卡住超过20分钟，按 `Ctrl+C` 中断，检查错误

**如果构建成功**，应该看到：
```
✓ Compiled successfully
```

### 4. 创建日志目录

```bash
mkdir -p /var/log/podroom
chown root:root /var/log/podroom
```

### 5. 启动应用

```bash
# 确认 ecosystem.config.js 配置正确
grep PORT ecosystem.config.js
# 应该显示 PORT: 3005

# 启动应用（PM2 会自动启动守护进程）
pm2 start ecosystem.config.js --env production

# 等待 5 秒
sleep 5

# 查看状态
pm2 list
# 应该显示：status: online, uptime: > 5s

# 查看日志，确认端口
pm2 logs podroom --lines 30 --nostream | grep -E "Local:|Network:"
# 应该显示 "Local: http://localhost:3005"

# 保存PM2配置（开机自启）
pm2 save

# 设置PM2开机自启
pm2 startup
# 按提示执行输出的命令（通常是 sudo env PATH=... pm2 startup systemd -u root --hp /root）
```

---

## 第七步：Nginx和HTTPS配置

### 1. 安装Nginx和Certbot

```bash
# 安装Nginx
apt install -y nginx

# 安装Certbot（用于获取SSL证书）
apt install -y certbot python3-certbot-nginx
```

### 2. 创建Nginx配置（先只配置HTTP，用于获取证书）

```bash
nano /etc/nginx/sites-available/podroom
```

**临时配置（仅用于获取证书）**：

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

### 3. 启用Nginx配置

```bash
# 创建符号链接
ln -s /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/

# 删除默认配置（如果存在）
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 如果测试通过，启动Nginx
systemctl start nginx
systemctl enable nginx
systemctl reload nginx
```

### 4. 配置防火墙

```bash
# 检查防火墙状态
ufw status

# 开放80和443端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3005/tcp  # 应用端口（可选，如果直接访问）
ufw reload
```

### 5. 配置阿里云安全组

在阿里云控制台：
1. 进入 **ECS实例** → 选择你的实例
2. 点击 **安全组** → **配置规则**
3. 确保有以下入站规则：
   - **端口 80**，协议 **TCP**，源 **0.0.0.0/0**
   - **端口 443**，协议 **TCP**，源 **0.0.0.0/0**
   - **端口 3005**，协议 **TCP**，源 **0.0.0.0/0**（可选）

### 6. 获取SSL证书

```bash
# 使用Certbot获取SSL证书（会自动配置HTTPS）
certbot --nginx -d podcasttoinsight.top -d www.podcasttoinsight.top

# 按提示操作：
# 1. 输入邮箱地址（用于证书到期提醒）
# 2. 同意服务条款（输入 Y）
# 3. 是否分享邮箱（可选，输入 Y 或 N）
# 4. Certbot会自动配置HTTPS并更新Nginx配置
```

**如果Certbot失败**（DNS问题或端口问题），可以使用手动DNS验证：

```bash
# 使用DNS验证方式
certbot certonly --manual --preferred-challenges dns -d podcasttoinsight.top -d www.podcasttoinsight.top

# 按提示添加DNS TXT记录，然后按Enter继续
```

### 7. 验证Nginx配置

```bash
# 测试配置
nginx -t

# 重新加载Nginx
systemctl reload nginx
```

---

## 第八步：域名配置

### 1. 在阿里云域名控制台配置DNS

1. 登录阿里云控制台：https://dns.console.aliyun.com
2. 找到域名 **podcasttoinsight.top**
3. 点击 **"解析设置"**
4. 添加/修改A记录：
   - **记录类型**：A
   - **主机记录**：@（或留空）
   - **记录值**：47.117.77.211（你的服务器IP）
   - **TTL**：600（或默认）
5. 添加www子域名（如果需要）：
   - **记录类型**：A
   - **主机记录**：www
   - **记录值**：47.117.77.211
   - **TTL**：600

### 2. 验证DNS解析

```bash
# 检查域名是否指向服务器IP
nslookup podcasttoinsight.top
dig podcasttoinsight.top +short
# 应该返回：47.117.77.211
```

---

## 第九步：验证部署

### 1. 检查应用状态

```bash
# PM2状态
pm2 list
# 应该显示 podroom 状态为 online

# 检查端口监听
netstat -tlnp | grep :3005
# 应该显示一个 next-server 进程

# 检查PM2守护进程（应该只有一个）
ps aux | grep "PM2.*God Daemon" | grep -v grep
```

### 2. 测试本地访问

```bash
# 测试本地访问
curl -I http://localhost:3005/home
# 应该返回 200 OK
```

### 3. 测试公网访问

```bash
# 测试HTTP（应该重定向到HTTPS）
curl -I http://podcasttoinsight.top/home

# 测试HTTPS
curl -I https://podcasttoinsight.top/home
# 应该返回 200 OK

# 测试MuleRun路由
curl -I https://podcasttoinsight.top/mulerun/session
```

### 4. 检查功能

在浏览器中访问：
- ✅ 首页：`https://podcasttoinsight.top/home`
- ✅ MuleRun测试：`https://podcasttoinsight.top/mulerun/preview`
- ✅ 测试播客处理功能
- ✅ 检查数据库连接

---

## 🔧 故障排查

### 问题1：构建卡住或失败

**解决方案**：
```bash
# 检查内存和swap
free -h

# 确保swap已启用
swapon --show

# 使用更小的内存限制重试
NODE_OPTIONS='--max-old-space-size=1024' pnpm build
```

### 问题2：应用无法启动

**检查**：
```bash
# 查看PM2日志
pm2 logs podroom --err --lines 50

# 检查端口是否被占用
netstat -tlnp | grep 3005

# 检查环境变量
pm2 env 0 | grep -E "DATABASE_URL|QWEN_API_KEY"
```

### 问题3：Nginx 502 Bad Gateway

**检查**：
```bash
# 检查应用是否运行
pm2 list

# 检查Nginx配置中的端口
cat /etc/nginx/sites-available/podroom | grep proxy_pass
# 应该显示：proxy_pass http://localhost:3005;

# 检查Nginx错误日志
tail -50 /var/log/nginx/error.log
```

### 问题4：SSL证书获取失败

**可能原因**：
1. DNS未正确解析
2. 80端口被占用
3. 防火墙阻止

**解决方案**：
```bash
# 检查DNS解析
nslookup podcasttoinsight.top

# 检查80端口
lsof -i :80

# 检查防火墙
ufw status
```

### 问题5：数据库连接失败

**检查**：
```bash
# 测试数据库连接
npx prisma db push

# 检查环境变量
grep DATABASE_URL .env
```

---

## 📝 快速检查清单

部署完成后，确认以下项目：

- [ ] Node.js 20.x 已安装
- [ ] pnpm 已安装
- [ ] PM2 已安装
- [ ] Swap空间已启用（2GB）
- [ ] 代码已克隆到 `/opt/podroom`
- [ ] 依赖已安装
- [ ] `.env` 文件已配置所有必需变量
- [ ] Prisma客户端已生成
- [ ] 数据库Schema已同步
- [ ] 应用已成功构建
- [ ] PM2应用状态为 `online`
- [ ] 应用在3005端口监听
- [ ] Nginx已安装并运行
- [ ] SSL证书已获取
- [ ] 域名DNS已配置
- [ ] 防火墙已开放80和443端口
- [ ] 阿里云安全组已配置
- [ ] HTTP访问正常
- [ ] HTTPS访问正常
- [ ] MuleRun路由可访问

---

## 🎯 总结

完整流程：
1. ✅ 重置服务器
2. ✅ 安装基础环境（Node.js, pnpm, PM2, FFmpeg）
3. ✅ 添加Swap空间（2GB）
4. ✅ 克隆代码并安装依赖
5. ✅ 配置环境变量（包括MuleRun配置）
6. ✅ 配置数据库
7. ✅ 构建应用（限制内存使用）
8. ✅ 启动应用（PM2生产模式）
9. ✅ 配置Nginx和HTTPS
10. ✅ 配置域名DNS
11. ✅ 验证部署

**关键点**：
- Swap空间是构建成功的关键
- 使用 `NODE_OPTIONS='--max-old-space-size=1536'` 限制内存
- 环境变量必须完整配置（特别是MuleRun相关）
- SSL证书获取可能需要DNS配置

---

## 📞 需要帮助？

如果遇到问题，检查：
1. PM2日志：`pm2 logs podroom --lines 100`
2. Nginx日志：`tail -50 /var/log/nginx/error.log`
3. 系统资源：`free -h` 和 `df -h`
4. 端口状态：`netstat -tlnp | grep -E "3005|80|443"`

