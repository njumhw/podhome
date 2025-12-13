# Certbot 403 错误修复指南

## 问题诊断

错误信息：`403 Invalid response from http://podcasttoinsight.top/.well-known/acme-challenge/...`

**原因**：Nginx 配置阻止了对 Certbot 验证路径的访问。

## 解决方案

### 方法 1: 修改 Nginx 配置，允许 ACME Challenge（推荐）

```bash
# 编辑 Nginx 配置
sudo nano /etc/nginx/sites-available/podroom
```

修改配置，添加 `.well-known` 路径的特殊处理：

```nginx
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    
    # 允许 Certbot 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    
    # 其他请求代理到应用
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

保存文件：`Ctrl+O` → `Enter` → `Ctrl+X`

```bash
# 创建验证目录
sudo mkdir -p /var/www/html/.well-known/acme-challenge
sudo chmod -R 755 /var/www/html

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 方法 2: 使用 standalone 模式（如果方法 1 不行）

```bash
# 1. 临时停止 Nginx
sudo systemctl stop nginx

# 2. 使用 standalone 模式获取证书
sudo certbot certonly --standalone -d podcasttoinsight.top -d www.podcasttoinsight.top

# 3. 启动 Nginx
sudo systemctl start nginx

# 4. 手动配置 Nginx 使用证书
sudo nano /etc/nginx/sites-available/podroom
```

然后使用完整的 HTTPS 配置：

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

    ssl_certificate /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/podcasttoinsight.top/privkey.pem;

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

## 检查清单

在获取证书前，确保：

- [ ] 域名 DNS 正确解析到服务器 IP（47.117.77.211）
- [ ] 80 端口已开放（防火墙和安全组）
- [ ] Nginx 配置允许访问 `.well-known/acme-challenge/`
- [ ] Nginx 正在运行
- [ ] 可以从外网访问 `http://podcasttoinsight.top`

## 验证 DNS 解析

```bash
# 检查域名解析
nslookup podcasttoinsight.top
dig podcasttoinsight.top +short

# 应该返回：47.117.77.211
```

## 验证端口开放

```bash
# 检查防火墙
sudo ufw status
sudo ufw allow 80/tcp

# 检查端口监听
sudo lsof -i :80
```

## 测试访问

```bash
# 测试 HTTP 访问
curl -I http://podcasttoinsight.top

# 测试验证路径（应该返回 404，不是 403）
curl -I http://podcasttoinsight.top/.well-known/acme-challenge/test
```

