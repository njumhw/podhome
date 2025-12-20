# 修复 Certbot 403 错误

## 问题
Certbot 验证失败，返回 403 Forbidden：
```
Invalid response from http://podcasttoinsight.top/.well-known/acme-challenge/...: 403
```

## 原因
Nginx 配置没有正确处理 `/.well-known/acme-challenge/` 路径，导致 Certbot 无法访问验证文件。

## 解决方案

### 方案1：修改 Nginx 配置，添加 acme-challenge 路径（推荐）

```bash
nano /etc/nginx/sites-available/podroom
```

**修改配置，添加 `/.well-known/acme-challenge/` 路径处理**：

```nginx
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    
    # Certbot 验证路径（必须放在 location / 之前）
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files $uri =404;
    }
    
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

**创建验证目录**：
```bash
mkdir -p /var/www/html/.well-known/acme-challenge
chown -R www-data:www-data /var/www/html
```

**测试并重新加载 Nginx**：
```bash
nginx -t
systemctl reload nginx
```

**重新运行 Certbot**：
```bash
certbot --nginx -d podcasttoinsight.top -d www.podcasttoinsight.top
```

---

### 方案2：使用 DNS 验证（如果方案1失败）

如果方案1仍然失败，可以使用 DNS 验证：

```bash
certbot certonly --manual --preferred-challenges dns -d podcasttoinsight.top -d www.podcasttoinsight.top
```

**按提示操作**：
1. Certbot 会显示需要添加的 DNS TXT 记录
2. 在阿里云 DNS 控制台添加这些 TXT 记录
3. 等待 1-2 分钟让 DNS 传播
4. 按 Enter 继续验证

**验证 DNS 记录**：
```bash
dig TXT _acme-challenge.podcasttoinsight.top +short
dig TXT _acme-challenge.www.podcasttoinsight.top +short
```

**手动配置 Nginx HTTPS**（DNS 验证成功后）：

```bash
nano /etc/nginx/sites-available/podroom
```

**完整配置**：

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
nginx -t
systemctl reload nginx
```

---

## 验证

```bash
# 测试 HTTPS
curl -I https://podcasttoinsight.top/home

# 应该返回 200 OK
```

---

## 推荐使用方案1

方案1更简单，Certbot 会自动配置 HTTPS。如果方案1失败，再使用方案2。

