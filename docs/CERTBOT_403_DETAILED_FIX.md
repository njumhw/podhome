# Certbot 403 错误详细修复指南

## 问题分析

Certbot 验证失败，返回 403 Forbidden。可能的原因：
1. Nginx 配置中 `/.well-known/acme-challenge/` 路径配置不正确
2. 目录权限问题
3. Next.js 应用拦截了这个路径
4. 防火墙或安全组阻止访问

## 解决方案

### 方案 1: 检查并修复 Nginx 配置

```bash
# 1. 查看当前配置
sudo cat /etc/nginx/sites-available/podroom

# 2. 确保配置正确
sudo nano /etc/nginx/sites-available/podroom
```

确保配置如下（**注意顺序，`/.well-known/` 必须在 `location /` 之前**）：

```nginx
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    
    # Certbot 验证路径（必须在 location / 之前）
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type "text/plain";
        try_files $uri =404;
    }
    
    # 其他请求转发到 Next.js
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

```bash
# 3. 确保目录存在且权限正确
sudo mkdir -p /var/www/html/.well-known/acme-challenge/
sudo chown -R www-data:www-data /var/www/html/.well-known/
sudo chmod -R 755 /var/www/html/.well-known/

# 4. 测试配置
sudo nginx -t

# 5. 重启 Nginx
sudo systemctl restart nginx

# 6. 测试路径是否可访问
curl http://podcasttoinsight.top/.well-known/acme-challenge/test
# 应该返回 404（不是 403），说明路径配置正确
```

### 方案 2: 使用 standalone 模式（推荐，更可靠）

如果方案 1 还是不行，使用 standalone 模式：

```bash
# 1. 停止 Nginx（Certbot standalone 需要占用 80 端口）
sudo systemctl stop nginx

# 2. 使用 standalone 模式获取证书
sudo certbot certonly --standalone -d podcasttoinsight.top -d www.podcasttoinsight.top

# 3. 启动 Nginx
sudo systemctl start nginx

# 4. 手动配置 Nginx 使用证书
sudo nano /etc/nginx/sites-available/podroom
```

使用以下配置：

```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    return 301 https://$server_name$request_uri;
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name podcasttoinsight.top www.podcasttoinsight.top;

    # SSL 证书路径
    ssl_certificate /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/podcasttoinsight.top/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 代理到 Next.js 应用
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

```bash
# 5. 测试配置
sudo nginx -t

# 6. 重启 Nginx
sudo systemctl restart nginx
```

### 方案 3: 检查防火墙和安全组

```bash
# 检查防火墙
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 检查端口是否监听
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443
```

确保阿里云安全组允许 80 和 443 端口。

### 方案 4: 检查 DNS 解析

```bash
# 检查域名解析
nslookup podcasttoinsight.top
dig podcasttoinsight.top +short

# 应该返回服务器 IP: 47.117.77.211
```

## 推荐执行顺序

1. **先尝试方案 2（standalone 模式）** - 最可靠，不依赖 Nginx 配置
2. 如果 standalone 成功，手动配置 Nginx 使用证书
3. 如果 standalone 也失败，检查防火墙和 DNS

