# HTTPS配置完整指南

## 前提条件

1. **有域名**（推荐）：可以申请Let's Encrypt免费SSL证书
2. **只有IP地址**：Let's Encrypt不支持IP证书，需要使用其他方案

## 方案A：使用Nginx + Let's Encrypt（推荐，有域名）

### 步骤1：安装Nginx和Certbot

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install nginx certbot python3-certbot-nginx -y
```

### 步骤2：配置域名解析

在域名服务商（如阿里云、Cloudflare等）添加A记录：
- 主机记录：`@` 或 `www` 或 `mulerun`（根据你的需求）
- 记录类型：`A`
- 记录值：你的服务器IP地址

等待DNS解析生效（通常几分钟到几小时）：
```bash
# 检查DNS解析
nslookup your-domain.com
# 或
dig your-domain.com
```

### 步骤3：配置Nginx反向代理

创建Nginx配置文件：

```bash
sudo nano /etc/nginx/sites-available/podroom
```

**复制以下内容**（替换`your-domain.com`为你的域名，`3000`为你的Next.js端口）：

```nginx
# HTTP重定向到HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

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
    server_name your-domain.com www.your-domain.com;

    # SSL证书（Certbot会自动配置）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 允许MuleRun iframe嵌入
    add_header X-Frame-Options "ALLOW-FROM https://mulerun.com" always;
    add_header Content-Security-Policy "frame-ancestors 'self' https://mulerun.com;" always;

    # 反向代理到Next.js应用
    location / {
        proxy_pass http://localhost:3000;  # 替换为你的Next.js端口
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

    # 特别配置MuleRun路由
    location /mulerun/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 允许MuleRun iframe嵌入
        add_header X-Frame-Options "ALLOW-FROM https://mulerun.com" always;
        add_header Content-Security-Policy "frame-ancestors 'self' https://mulerun.com;" always;
    }
}
```

保存并退出（nano: `Ctrl+O`, `Enter`, `Ctrl+X`）

### 步骤4：启用配置

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/

# 删除默认配置（如果存在）
sudo rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
sudo nginx -t

# 如果测试通过，启动/重载Nginx
sudo systemctl start nginx
sudo systemctl enable nginx  # 设置开机自启
sudo systemctl reload nginx
```

### 步骤5：申请SSL证书

```bash
# 申请证书（替换为你的域名）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 按提示操作：
# 1. 输入邮箱地址
# 2. 同意服务条款
# 3. 选择是否分享邮箱（可选）
# 4. Certbot会自动配置Nginx
```

### 步骤6：设置自动续期

Let's Encrypt证书有效期90天，需要自动续期：

```bash
# 测试自动续期
sudo certbot renew --dry-run

# 证书会自动续期（Certbot已配置cron任务）
```

## 方案B：使用Cloudflare（如果有域名在Cloudflare）

### 步骤1：在Cloudflare中配置

1. 登录Cloudflare控制台
2. 添加你的域名
3. 修改DNS记录，添加A记录指向服务器IP
4. 在SSL/TLS设置中：
   - 加密模式：选择"Full"或"Full (strict)"
   - 始终使用HTTPS：开启

### 步骤2：配置Nginx

```bash
sudo nano /etc/nginx/sites-available/podroom
```

使用与方案A相同的配置，但**不需要**申请Let's Encrypt证书（Cloudflare会处理SSL）。

## 方案C：只有IP地址，没有域名

**问题**：Let's Encrypt不支持IP证书，MuleRun可能不接受自签名证书。

**解决方案**：
1. **申请免费域名**：
   - Freenom（免费域名）
   - Cloudflare提供的免费域名服务
   - 然后使用方案A或B

2. **使用Cloudflare Tunnel**（推荐）：
   - 不需要公网IP
   - Cloudflare自动提供HTTPS
   - 免费且简单

## 验证HTTPS配置

### 1. 测试HTTPS访问

```bash
# 测试HTTPS
curl -I https://your-domain.com

# 应该看到200状态码，而不是重定向
```

### 2. 测试MuleRun路由

```bash
# 测试MuleRun Agent页面
curl -I https://your-domain.com/mulerun/agent

# 检查响应头中是否有X-Frame-Options
curl -I https://your-domain.com/mulerun/agent | grep -i frame
```

### 3. 在浏览器中测试

访问：`https://your-domain.com/mulerun/agent`

应该：
- 显示绿色锁图标（HTTPS）
- 页面正常加载
- 没有SSL警告

## 常见问题

### Q1: Certbot申请证书失败

**可能原因**：
- DNS解析未生效
- 80端口被占用
- 防火墙未开放80和443端口

**解决方案**：
```bash
# 检查80端口
sudo netstat -tlnp | grep :80

# 检查防火墙
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Q2: Nginx配置测试失败

```bash
# 查看详细错误
sudo nginx -t

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

### Q3: 反向代理502错误

**可能原因**：Next.js应用未运行或端口不对

**解决方案**：
```bash
# 检查Next.js是否运行
pm2 list
# 或
ps aux | grep node

# 检查端口
netstat -tlnp | grep 3000
```

## 完整操作流程（快速参考）

```bash
# 1. 安装Nginx和Certbot
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# 2. 配置Nginx
sudo nano /etc/nginx/sites-available/podroom
# （复制上面的配置内容，替换域名和端口）

# 3. 启用配置
sudo ln -s /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. 申请SSL证书
sudo certbot --nginx -d your-domain.com

# 5. 验证
curl -I https://your-domain.com/mulerun/agent
```

## 下一步

HTTPS配置完成后：
1. 在MuleRun Creator Studio中填写Start Session URL：`https://your-domain.com/mulerun/agent`
2. 测试Agent是否正常工作

