# 诊断网页无法访问问题

## 问题
PM2 显示应用状态为 `online`，但网页完全打不开。

## 诊断步骤

### 步骤1：检查应用是否真的在监听端口

```bash
# 检查 3005 端口是否有进程在监听
netstat -tlnp | grep :3005

# 或使用
lsof -i :3005 | grep LISTEN
```

**预期输出**：应该显示一个 `next-server` 进程在监听 `:3005`

**如果没有输出**，说明应用没有正确启动。

### 步骤2：检查应用日志

```bash
# 查看 PM2 日志
pm2 logs podroom --lines 50 --nostream

# 查看错误日志
pm2 logs podroom --err --lines 50 --nostream
```

**检查是否有错误信息**，特别是：
- 端口冲突
- 数据库连接失败
- 环境变量缺失

### 步骤3：测试本地访问

```bash
# 测试本地访问
curl -I http://localhost:3005/home

# 或
curl http://localhost:3005/home
```

**如果返回 200 OK**，说明应用正常运行，问题在 Nginx 或网络。

**如果返回错误**，说明应用有问题，查看日志。

### 步骤4：检查 Nginx 状态

```bash
# 检查 Nginx 是否运行
systemctl status nginx

# 检查 Nginx 错误日志
tail -50 /var/log/nginx/error.log
```

### 步骤5：检查 Nginx 配置

```bash
# 查看 Nginx 配置
cat /etc/nginx/sites-available/podroom

# 检查配置中的端口是否正确
grep proxy_pass /etc/nginx/sites-available/podroom
# 应该显示：proxy_pass http://localhost:3005;
```

### 步骤6：检查防火墙

```bash
# 检查防火墙状态
ufw status

# 检查端口是否开放
ufw status | grep -E "80|443|3005"
```

### 步骤7：检查阿里云安全组

在阿里云控制台确认：
- 端口 80 已开放
- 端口 443 已开放
- 端口 3005 已开放（如果直接访问）

### 步骤8：测试 HTTP 和 HTTPS

```bash
# 测试 HTTP（应该重定向到 HTTPS）
curl -I http://podcasttoinsight.top/home

# 测试 HTTPS
curl -I https://podcasttoinsight.top/home

# 测试 IP 直接访问（如果安全组允许）
curl -I http://47.117.77.211:3005/home
```

---

## 常见问题和解决方案

### 问题1：应用没有监听端口

**症状**：`netstat -tlnp | grep :3005` 没有输出

**解决方案**：
```bash
# 查看应用日志
pm2 logs podroom --err --lines 50 --nostream

# 重启应用
pm2 restart podroom

# 等待5秒后检查
sleep 5
netstat -tlnp | grep :3005
```

### 问题2：Nginx 502 Bad Gateway

**症状**：`curl -I https://podcasttoinsight.top/home` 返回 502

**解决方案**：
```bash
# 检查应用是否运行
pm2 list

# 检查 Nginx 配置中的端口
grep proxy_pass /etc/nginx/sites-available/podroom

# 检查 Nginx 错误日志
tail -50 /var/log/nginx/error.log
```

### 问题3：Nginx 未运行

**症状**：`systemctl status nginx` 显示 inactive

**解决方案**：
```bash
# 启动 Nginx
systemctl start nginx

# 检查状态
systemctl status nginx
```

### 问题4：防火墙阻止

**症状**：本地可以访问，但公网无法访问

**解决方案**：
```bash
# 开放端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3005/tcp
ufw reload
```

### 问题5：应用启动失败

**症状**：PM2 显示 `online`，但日志有错误

**解决方案**：
```bash
# 查看详细日志
pm2 logs podroom --lines 100 --nostream

# 检查环境变量
pm2 env 0 | grep -E "DATABASE_URL|PORT"

# 重启应用
pm2 restart podroom
```

---

## 快速诊断命令

执行以下命令，把输出发给我：

```bash
# 1. PM2 状态
pm2 list

# 2. 端口监听
netstat -tlnp | grep :3005

# 3. 本地访问测试
curl -I http://localhost:3005/home

# 4. Nginx 状态
systemctl status nginx

# 5. Nginx 错误日志（最后20行）
tail -20 /var/log/nginx/error.log

# 6. 应用日志（最后20行）
pm2 logs podroom --lines 20 --nostream

# 7. HTTPS 测试
curl -I https://podcasttoinsight.top/home
```

把这些命令的输出发给我，我可以帮你定位问题。

