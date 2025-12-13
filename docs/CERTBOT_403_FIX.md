# Certbot 403 错误修复指南

## 问题原因

Certbot 验证失败，返回 403 Forbidden，因为 `/.well-known/acme-challenge/` 路径被转发到了 Next.js 应用，而不是由 Nginx 直接处理。

## 解决方案

### 方法 1: 修改 Nginx 配置（推荐）

在 Nginx 配置中添加对 ACME challenge 路径的特殊处理：

```bash
sudo nano /etc/nginx/sites-available/podroom
```

修改配置为：

```nginx
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    
    # Certbot 验证路径（必须放在 location / 之前）
    location /.well-known/acme-challenge/ {
        root /var/www/html;
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

保存后：

```bash
# 创建验证目录
sudo mkdir -p /var/www/html/.well-known/acme-challenge/
sudo chown -R www-data:www-data /var/www/html/.well-known/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 重新运行 Certbot
sudo certbot --nginx -d podcasttoinsight.top -d www.podcasttoinsight.top
```

### 方法 2: 使用 standalone 模式（如果方法 1 不行）

```bash
# 1. 停止 Nginx（Certbot 需要占用 80 端口）
sudo systemctl stop nginx

# 2. 使用 standalone 模式获取证书
sudo certbot certonly --standalone -d podcasttoinsight.top -d www.podcasttoinsight.top

# 3. 启动 Nginx
sudo systemctl start nginx

# 4. 手动配置 Nginx 使用证书
sudo nano /etc/nginx/sites-available/podroom
```

然后使用包含 SSL 证书的完整配置。
