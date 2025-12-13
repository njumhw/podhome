# Nginx HTTPS 配置指南（服务器重置后）

## 问题诊断

如果 `http://47.117.77.211:3005/home` 可以访问，但 `https://podcasttoinsight.top` 无法访问，说明：
1. ✅ 应用正常运行（3005端口）
2. ❌ Nginx 配置可能丢失或错误
3. ❌ SSL 证书可能未配置或过期

## 解决步骤

### 步骤 1: 检查 Nginx 是否安装和运行

```bash
# 检查 Nginx 是否安装
which nginx
nginx -v

# 检查 Nginx 状态
sudo systemctl status nginx

# 如果未安装，安装 Nginx
sudo apt update
sudo apt install nginx -y
```

### 步骤 2: 检查 Nginx 配置文件

```bash
# 检查配置文件是否存在
ls -la /etc/nginx/sites-available/podroom
ls -la /etc/nginx/sites-enabled/podroom

# 查看配置文件内容
sudo cat /etc/nginx/sites-available/podroom
```

### 步骤 3: 创建/更新 Nginx 配置

如果配置文件不存在或内容不正确，创建新的配置：

```bash
# 创建配置文件
sudo nano /etc/nginx/sites-available/podroom
```

粘贴以下内容：

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

    # SSL 证书路径（如果已存在）
    ssl_certificate /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/podcasttoinsight.top/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/podroom_access.log;
    error_log /var/log/nginx/podroom_error.log;

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
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

保存文件：`Ctrl+O` → `Enter` → `Ctrl+X`

### 步骤 4: 创建符号链接

```bash
# 创建符号链接
sudo ln -sf /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/

# 删除默认配置（如果存在）
sudo rm -f /etc/nginx/sites-enabled/default
```

### 步骤 5: 检查 SSL 证书

```bash
# 检查证书是否存在
sudo ls -la /etc/letsencrypt/live/podcasttoinsight.top/

# 检查证书有效期
sudo certbot certificates
```

### 步骤 6: 如果证书不存在，获取 SSL 证书

```bash
# 方法 1: 使用 Certbot（推荐）
# 先临时修改 Nginx 配置，只监听 HTTP（用于获取证书）
sudo nano /etc/nginx/sites-available/podroom
```

临时配置（仅用于获取证书）：

```nginx
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    
    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 安装 Certbot（如果未安装）
sudo apt install certbot python3-certbot-nginx -y

# 获取 SSL 证书（会自动配置 HTTPS）
sudo certbot --nginx -d podcasttoinsight.top -d www.podcasttoinsight.top

# Certbot 会自动更新 Nginx 配置，添加 HTTPS 和重定向
```

### 步骤 7: 测试 Nginx 配置

```bash
# 测试配置语法
sudo nginx -t

# 如果测试通过，重新加载 Nginx
sudo systemctl reload nginx
```

### 步骤 8: 检查防火墙

```bash
# 检查防火墙状态
sudo ufw status

# 确保 80 和 443 端口已开放
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 步骤 9: 检查阿里云安全组

在阿里云控制台：
1. 进入 **ECS 实例** → 选择你的实例
2. 点击 **安全组** → **配置规则**
3. 确保有以下入站规则：
   - **端口 80**，协议 **TCP**，源 **0.0.0.0/0**
   - **端口 443**，协议 **TCP**，源 **0.0.0.0/0**

### 步骤 10: 验证 DNS 解析

```bash
# 检查域名是否指向服务器 IP
nslookup podcasttoinsight.top
dig podcasttoinsight.top +short
```

**预期结果**：应该返回你的服务器 IP 地址（47.117.77.211）

### 步骤 11: 测试访问

```bash
# 测试 HTTP（应该重定向到 HTTPS）
curl -I http://podcasttoinsight.top

# 测试 HTTPS
curl -I https://podcasttoinsight.top

# 测试 MuleRun 路由
curl -I https://podcasttoinsight.top/mulerun/session
```

## 常见问题

### 问题 1: Nginx 配置测试失败

**错误信息**：`nginx: configuration file /etc/nginx/nginx.conf test failed`

**解决方案**：
```bash
# 查看详细错误
sudo nginx -t

# 检查配置文件语法
sudo nginx -T | grep -A 5 -B 5 error
```

### 问题 2: SSL 证书获取失败

**可能原因**：
1. 域名 DNS 未正确解析
2. 80 端口被占用
3. 防火墙阻止访问

**解决方案**：
```bash
# 检查 DNS 解析
nslookup podcasttoinsight.top

# 检查 80 端口
sudo lsof -i :80

# 检查防火墙
sudo ufw status
```

### 问题 3: 502 Bad Gateway

**可能原因**：
1. 应用未运行
2. 应用端口不正确（应该是 3005）

**解决方案**：
```bash
# 检查应用是否运行
pm2 list

# 检查端口
sudo lsof -i :3005

# 检查 Nginx 配置中的端口
sudo cat /etc/nginx/sites-available/podroom | grep proxy_pass
```

### 问题 4: ERR_CONNECTION_CLOSED

**可能原因**：
1. Nginx 未运行
2. SSL 证书配置错误
3. 防火墙阻止

**解决方案**：
```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 检查 Nginx 错误日志
sudo tail -50 /var/log/nginx/error.log

# 检查 SSL 证书
sudo certbot certificates
```

## 快速检查清单

- [ ] Nginx 已安装并运行
- [ ] Nginx 配置文件存在且正确
- [ ] SSL 证书已获取且有效
- [ ] 防火墙允许 80 和 443 端口
- [ ] 阿里云安全组允许 80 和 443 端口
- [ ] DNS 解析正确（指向服务器 IP）
- [ ] 应用在 3005 端口运行
- [ ] Nginx 配置测试通过

