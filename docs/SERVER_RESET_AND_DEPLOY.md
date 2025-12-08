# 服务器重置和完整部署指南

## 为什么服务器会突然出现问题？

可能的原因：
1. **系统自动更新**：Ubuntu/Debian 系统可能自动更新了某些依赖
2. **磁盘空间或I/O性能下降**：临时文件积累，磁盘碎片
3. **其他服务占用资源**：系统服务、日志文件等
4. **环境变量或配置变化**：某些系统级配置被修改
5. **内存泄漏**：长期运行导致内存碎片化

**重置是最彻底的解决方案**，可以确保环境干净，避免未知问题。

---

## 第一步：重置服务器

### 在阿里云控制台操作：

1. 登录阿里云控制台
2. 找到ECS实例
3. 选择"重置实例"或"更换系统盘"
4. **重要**：选择"保留数据盘"（如果数据盘有重要数据）
5. 选择系统镜像（Ubuntu 22.04 或 24.04）
6. 设置root密码或SSH密钥
7. 确认重置

### 等待重置完成（通常5-10分钟）

---

## 第二步：初始服务器配置

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

## 第三步：添加Swap空间（重要！）

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

## 第四步：克隆代码并配置

### 1. 创建项目目录

```bash
mkdir -p /opt
cd /opt
```

### 2. 克隆代码

```bash
git clone https://github.com/njumhw/podhome.git podroom
cd podroom
```

### 3. 检查代码版本

```bash
git log --oneline -1
# 应该显示：0b468af fix: 修复播客处理链路问题
```

### 4. 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 5. 配置环境变量

```bash
# 复制环境变量模板
cp env.example .env

# 编辑环境变量（使用nano或vi）
nano .env
```

**必须配置的环境变量**：
- `DATABASE_URL`：数据库连接字符串
- `QWEN_API_KEY`：通义千问API密钥
- `ALIYUN_OSS_BUCKET`：OSS存储桶名称
- `ALIYUN_OSS_REGION`：OSS区域
- `ALIYUN_ACCESS_KEY_ID`：阿里云AccessKey ID
- `ALIYUN_ACCESS_KEY_SECRET`：阿里云AccessKey Secret
- `NEXT_PUBLIC_BASE_URL`：应用访问地址
- `PORT`：端口号（默认3005）

保存：`Ctrl+O`，`Enter`，`Ctrl+X`

---

## 第五步：数据库配置

### 1. 生成Prisma客户端

```bash
npx prisma generate
```

### 2. 同步数据库Schema

```bash
npx prisma db push
```

---

## 第六步：构建应用（关键步骤）

### 1. 清理缓存

```bash
rm -rf .next
rm -rf node_modules/.cache
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
# 限制Node.js内存使用，避免OOM
NODE_OPTIONS='--max-old-space-size=2048' pnpm build
```

**构建过程**：
- Prisma生成：约1-2秒
- Next.js构建：约5-15分钟（取决于服务器性能）
- 如果卡住超过20分钟，按Ctrl+C中断，检查错误

### 4. 如果构建成功

应该看到：
```
✓ Compiled successfully
```

### 5. 如果构建失败

**检查错误**：
```bash
# 查看构建日志的最后部分
# 通常错误信息会在最后显示
```

**常见问题**：
- 内存不足：确保swap已启用，使用 `NODE_OPTIONS='--max-old-space-size=1536'`
- 磁盘空间不足：清理空间 `df -h`，删除不需要的文件
- 依赖问题：重新安装 `rm -rf node_modules && pnpm install`

---

## 第七步：启动应用

### 方式1：生产模式（推荐，如果构建成功）

```bash
# 使用PM2启动生产模式
pm2 start ecosystem.config.js --env production

# 查看状态
pm2 list

# 查看日志
pm2 logs podroom --lines 30

# 保存PM2配置（开机自启）
pm2 save
```

### 方式2：开发模式（如果构建失败，临时使用）

```bash
# 使用PM2启动开发模式
pm2 start pnpm --name podroom -- run dev

# 查看状态
pm2 list

# 查看日志
pm2 logs podroom --lines 30

# 保存PM2配置
pm2 save
```

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

**配置内容**（替换`your-domain.com`和端口`3005`）：

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

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

### 3. 启用配置

```bash
ln -s /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### 4. 配置HTTPS（可选）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com -d www.your-domain.com
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
```

### 2. 测试访问

```bash
# 测试本地访问
curl -I http://localhost:3005/home
# 应该返回 200 OK

# 测试外部访问（如果有域名）
curl -I http://your-domain.com/home
# 应该返回 200 OK
```

### 3. 检查功能

- 访问首页：`http://your-domain.com/home`
- 测试播客处理功能
- 检查数据库连接

---

## 故障排查

### 问题1：构建卡住

**解决方案**：
1. 检查内存和swap：`free -h`
2. 确保swap已启用：`swapon --show`
3. 使用更小的内存限制：`NODE_OPTIONS='--max-old-space-size=1536' pnpm build`
4. 如果还是卡住，使用开发模式：`pm2 start pnpm --name podroom -- run dev`

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

### 问题3：数据库连接失败

**检查**：
```bash
# 测试数据库连接
npx prisma db push

# 检查环境变量
grep DATABASE_URL .env
```

---

## 维护建议

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

### 更新代码

```bash
cd /opt/podroom
git pull origin main
pnpm install
npx prisma generate
NODE_OPTIONS='--max-old-space-size=2048' pnpm build
pm2 restart podroom
```

---

## 总结

重置服务器后的完整流程：
1. ✅ 重置服务器
2. ✅ 安装基础环境（Node.js, pnpm, PM2）
3. ✅ 添加Swap空间（2GB）
4. ✅ 克隆代码并配置环境变量
5. ✅ 构建应用（限制内存使用）
6. ✅ 启动应用（生产模式或开发模式）
7. ✅ 配置Nginx和HTTPS（可选）
8. ✅ 验证部署

**关键点**：
- Swap空间是构建成功的关键
- 使用 `NODE_OPTIONS='--max-old-space-size=2048'` 限制内存
- 如果构建失败，可以使用开发模式作为备选

