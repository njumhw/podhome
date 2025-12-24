# 完整的 Nginx 配置文件

## 配置文件位置
`/etc/nginx/sites-available/podroom`

## 完整配置内容

```nginx
# 1. 自动将 HTTP (80) 转为 HTTPS (443)
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    return 301 https://$server_name$request_uri;
}

# 2. 真正的 HTTPS 配置
server {
    listen 443 ssl http2;
    server_name podcasttoinsight.top www.podcasttoinsight.top;

    # 证书路径
    ssl_certificate /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/podcasttoinsight.top/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志（可选，用于调试）
    access_log /var/log/nginx/podroom_access.log;
    error_log /var/log/nginx/podroom_error.log;

    # 主应用代理
    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 标准代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # ========== 超时设置（关键修复，提高稳定性）==========
        proxy_connect_timeout 120s;      # 连接到后端服务器的超时时间：120秒
        proxy_send_timeout 120s;        # 向后端服务器发送请求的超时时间：120秒
        proxy_read_timeout 120s;        # 从后端服务器读取响应的超时时间：120秒
        
        # 缓冲设置（提高性能）
        proxy_buffering on;             # 启用响应缓冲
        proxy_buffer_size 4k;          # 响应头缓冲区大小：4KB
        proxy_buffers 8 4k;             # 响应体缓冲区：8个，每个4KB
        proxy_busy_buffers_size 8k;    # 忙碌缓冲区大小：8KB
        # ====================================================
    }

    # API 路由（可选，如果需要单独配置）
    location /api/ {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # API 专用超时设置（可以设置更长）
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # 禁用 API 缓存（确保数据实时性）
        proxy_buffering off;
    }
}
```

## 配置说明

### 超时参数
- **`proxy_connect_timeout 120s`**: 连接到后端服务器的超时时间（120秒）
  - 如果后端服务器在 120 秒内无法连接，Nginx 会返回 502 错误
- **`proxy_send_timeout 120s`**: 向后端服务器发送请求的超时时间（120秒）
  - 如果向后端发送请求超过 120 秒，Nginx 会断开连接
- **`proxy_read_timeout 120s`**: 从后端服务器读取响应的超时时间（120秒）
  - 如果后端服务器在 120 秒内没有响应，Nginx 会断开连接

### 缓冲参数
- **`proxy_buffering on`**: 启用响应缓冲，提高性能
- **`proxy_buffer_size 4k`**: 响应头缓冲区大小（4KB）
- **`proxy_buffers 8 4k`**: 响应体缓冲区（8个，每个4KB，总共32KB）
- **`proxy_busy_buffers_size 8k`**: 忙碌缓冲区大小（8KB）

## 应用配置步骤

### 1. 备份当前配置
```bash
cp /etc/nginx/sites-available/podroom /etc/nginx/sites-available/podroom.backup.$(date +%Y%m%d-%H%M%S)
```

### 2. 编辑配置文件
```bash
nano /etc/nginx/sites-available/podroom
```

### 3. 替换为完整配置
删除所有内容，粘贴上面的完整配置内容。

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
curl -I https://podcasttoinsight.top/api/public/list?type=latest
```

## 预期效果

修复后：
- ✅ 长时间请求不会被过早断开（120秒超时）
- ✅ 网络抖动时连接更稳定
- ✅ API 请求更可靠
- ✅ 用户体验更稳定

## 注意事项

1. **超时时间**：120 秒足够处理大多数请求，如果某些请求需要更长时间，可以进一步增加
2. **修改后需要重新加载**：使用 `systemctl reload nginx`，不需要重启
3. **日志位置**：访问日志和错误日志保存在 `/var/log/nginx/` 目录
4. **API 缓存**：`/api/` 路由禁用了缓冲，确保数据实时性

## 故障排查

如果配置后出现问题：

1. **检查配置语法**：
   ```bash
   nginx -t
   ```

2. **查看错误日志**：
   ```bash
   tail -f /var/log/nginx/podroom_error.log
   ```

3. **查看 Nginx 状态**：
   ```bash
   systemctl status nginx
   ```

4. **恢复备份**（如果需要）：
   ```bash
   cp /etc/nginx/sites-available/podroom.backup.* /etc/nginx/sites-available/podroom
   systemctl reload nginx
   ```

