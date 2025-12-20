# 修复 Nginx 配置错误

## 问题
Nginx 配置文件第一行有 `nginx`，导致配置错误：
```
unknown directive "nginx" in /etc/nginx/sites-enabled/podroom:2
```

## 解决方案

### 1. 删除错误的配置文件

```bash
# 删除符号链接
rm -f /etc/nginx/sites-enabled/podroom

# 删除配置文件
rm -f /etc/nginx/sites-available/podroom
```

### 2. 重新创建正确的配置文件

```bash
nano /etc/nginx/sites-available/podroom
```

**粘贴以下配置**（注意：不要包含 `nginx` 开头，直接以 `server {` 开始）：

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

**重要**：
- 第一行必须是 `server {`，不能有 `nginx` 或其他内容
- 保存：`Ctrl+O` → `Enter` → `Ctrl+X`

### 3. 创建符号链接

```bash
ln -s /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/
```

### 4. 测试配置

```bash
nginx -t
```

**应该看到**：
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 5. 启动 Nginx

```bash
systemctl start nginx
systemctl enable nginx
systemctl reload nginx
```

### 6. 检查状态

```bash
systemctl status nginx
```

**应该看到**：`Active: active (running)`

---

## 验证

```bash
# 测试本地访问
curl -I http://localhost:3005/home

# 测试 Nginx 代理
curl -I http://podcasttoinsight.top/home
```

如果都返回 `200 OK` 或 `301/302`（重定向），说明配置成功。

