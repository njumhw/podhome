# 详细修复 Certbot 403 错误

## 问题诊断

Certbot 仍然返回 403，可能的原因：
1. Nginx 配置没有正确保存
2. 权限问题
3. Certbot 无法写入验证文件
4. 需要使用 standalone 模式

## 解决方案

### 步骤1：检查当前 Nginx 配置

```bash
# 查看当前配置
cat /etc/nginx/sites-available/podroom
```

**确认配置包含**：
- `location /.well-known/acme-challenge/` 块
- 该块在 `location /` 之前

### 步骤2：使用 Standalone 模式（推荐，最简单）

Standalone 模式不需要修改 Nginx 配置，Certbot 会临时启动一个服务器来验证。

```bash
# 1. 停止 Nginx（Certbot 需要占用 80 端口）
systemctl stop nginx

# 2. 使用 standalone 模式获取证书
certbot certonly --standalone -d podcasttoinsight.top -d www.podcasttoinsight.top

# 按提示操作：
# - 输入邮箱
# - 同意服务条款（Y）
# - 是否分享邮箱（可选）
```

**如果成功**，应该看到：
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem
```

**3. 重新启动 Nginx**
```bash
systemctl start nginx
```

**4. 手动配置 Nginx HTTPS**

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

保存：`Ctrl+O` → `Enter` → `Ctrl+X`

**5. 测试并重新加载 Nginx**

```bash
nginx -t
systemctl reload nginx
```

---

### 步骤3：验证 HTTPS

```bash
# 测试 HTTPS
curl -I https://podcasttoinsight.top/home

# 应该返回 200 OK
```

---

## 如果 Standalone 模式也失败

### 使用 DNS 验证（最可靠）

```bash
# 使用 DNS 验证
certbot certonly --manual --preferred-challenges dns -d podcasttoinsight.top -d www.podcasttoinsight.top
```

**按提示操作**：
1. Certbot 会显示需要添加的 DNS TXT 记录
2. 在阿里云 DNS 控制台添加这些 TXT 记录
3. 等待 1-2 分钟
4. 验证 DNS 记录：
   ```bash
   dig TXT _acme-challenge.podcasttoinsight.top +short
   dig TXT _acme-challenge.www.podcasttoinsight.top +short
   ```
5. 按 Enter 继续

DNS 验证成功后，按照上面的步骤4手动配置 Nginx HTTPS。

---

## 推荐流程

1. **先尝试 Standalone 模式**（最简单，不需要修改 Nginx）
2. 如果失败，使用 **DNS 验证**（最可靠）

