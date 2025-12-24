# Nginx 超时配置优化（服务器端修复）

## 问题

Nginx 没有显式配置超时设置，默认超时可能不够，导致：
- 长时间请求被过早断开
- 网络抖动时连接失败
- 用户体验不稳定

## 修复步骤

### 1. 备份当前配置

```bash
cp /etc/nginx/sites-available/podroom /etc/nginx/sites-available/podroom.backup
```

### 2. 编辑配置文件

```bash
nano /etc/nginx/sites-available/podroom
```

### 3. 添加超时配置

**如果使用 HTTP（端口 80）**，在 `location /` 块中添加：

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
        
        # ========== 增加超时时间（关键修复）==========
        proxy_connect_timeout 120s;      # 连接超时：120秒
        proxy_send_timeout 120s;        # 发送超时：120秒
        proxy_read_timeout 120s;        # 读取超时：120秒
        
        # 缓冲设置（提高性能）
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        # ============================================
    }
}
```

**如果使用 HTTPS（端口 443）**，在 `location /` 块中添加相同的超时配置：

```nginx
server {
    listen 443 ssl http2;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    
    # SSL 配置...
    ssl_certificate /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/podcasttoinsight.top/privkey.pem;
    
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
        
        # ========== 增加超时时间（关键修复）==========
        proxy_connect_timeout 120s;      # 连接超时：120秒
        proxy_send_timeout 120s;        # 发送超时：120秒
        proxy_read_timeout 120s;        # 读取超时：120秒
        
        # 缓冲设置（提高性能）
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        # ============================================
    }
}
```

### 4. 保存文件

- 保存：`Ctrl+O` → `Enter`
- 退出：`Ctrl+X`

### 5. 测试配置

```bash
nginx -t
```

**应该看到**：
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 6. 重新加载 Nginx

```bash
systemctl reload nginx
```

### 7. 验证配置

```bash
# 检查超时配置是否已添加
grep -i "timeout" /etc/nginx/sites-available/podroom

# 应该看到：
# proxy_connect_timeout 120s;
# proxy_send_timeout 120s;
# proxy_read_timeout 120s;
```

### 8. 测试 API 响应

```bash
# 测试本地 API（应该正常）
curl -I http://localhost:3005/api/public/list?type=latest

# 测试通过 Nginx（应该正常）
curl -I http://podcasttoinsight.top/api/public/list?type=latest
```

## 配置说明

### 超时参数

- **`proxy_connect_timeout 120s`**: 连接到后端服务器的超时时间（120秒）
- **`proxy_send_timeout 120s`**: 向后端服务器发送请求的超时时间（120秒）
- **`proxy_read_timeout 120s`**: 从后端服务器读取响应的超时时间（120秒）

### 缓冲参数

- **`proxy_buffering on`**: 启用响应缓冲
- **`proxy_buffer_size 4k`**: 响应头缓冲区大小
- **`proxy_buffers 8 4k`**: 响应体缓冲区数量和大小
- **`proxy_busy_buffers_size 8k`**: 忙碌缓冲区大小

## 预期效果

修复后：
- ✅ 长时间请求不会被过早断开
- ✅ 网络抖动时连接更稳定
- ✅ 用户体验更稳定

## 注意事项

- 超时时间设置为 120 秒，足够处理大多数请求
- 如果某些请求需要更长时间，可以进一步增加
- 修改配置后需要重新加载 Nginx（`systemctl reload nginx`），不需要重启

