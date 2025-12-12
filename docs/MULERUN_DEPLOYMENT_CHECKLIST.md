# MuleRun 部署检查清单

## 1. HTTPS 配置检查

### 检查 Nginx 配置

```bash
# 在服务器上执行
sudo nginx -t
sudo cat /etc/nginx/sites-available/podroom
```

### 检查 SSL 证书

```bash
# 检查证书是否存在
sudo ls -la /etc/letsencrypt/live/podcasttoinsight.top/

# 检查证书有效期
sudo certbot certificates
```

### 如果还没有配置 HTTPS

```bash
# 1. 安装 Certbot（如果还没有）
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# 2. 配置 Nginx（确保域名指向服务器 IP）
sudo nano /etc/nginx/sites-available/podroom

# 3. 临时配置（只监听 HTTP，用于获取证书）
# server {
#     listen 80;
#     server_name podcasttoinsight.top www.podcasttoinsight.top;
#     ...
# }

# 4. 测试 Nginx 配置
sudo nginx -t

# 5. 重启 Nginx
sudo systemctl restart nginx

# 6. 获取 SSL 证书（会自动配置 HTTPS）
sudo certbot --nginx -d podcasttoinsight.top -d www.podcasttoinsight.top

# 7. 验证证书自动续期
sudo certbot renew --dry-run
```

## 2. 域名 DNS 配置检查

### 检查域名解析

```bash
# 检查域名是否指向服务器 IP
nslookup podcasttoinsight.top
dig podcasttoinsight.top
```

### 确保 DNS 记录正确

- **A 记录**：`podcasttoinsight.top` → 服务器 IP
- **A 记录**：`www.podcasttoinsight.top` → 服务器 IP（可选）

## 3. Nginx 配置示例

```nginx
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name podcasttoinsight.top www.podcasttoinsight.top;

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

## 4. 防火墙配置

```bash
# 确保防火墙允许 HTTPS
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
sudo ufw status
```

## 5. 阿里云安全组配置

在阿里云控制台：
1. 进入 **ECS 实例** → **安全组**
2. 添加入站规则：
   - **端口**：443
   - **协议**：TCP
   - **源**：0.0.0.0/0
   - **描述**：HTTPS

## 6. 测试 HTTPS

```bash
# 测试 HTTPS 连接
curl -I https://podcasttoinsight.top

# 测试 MuleRun 路由
curl -I https://podcasttoinsight.top/mulerun/session
```

