# 修复 Nginx 服务失败问题

## 问题诊断

从诊断结果看：
- ✅ 应用正常运行（PM2 online，端口3005监听）
- ✅ 本地访问正常（curl返回307重定向）
- ❌ **Nginx服务已停止**（状态：failed，被KILL信号终止）

## 解决方案

### 步骤1：检查Nginx配置

```bash
# 检查Nginx配置语法
nginx -t
```

如果配置有错误，先修复配置。

### 步骤2：检查Nginx错误日志

```bash
# 查看Nginx错误日志（查看被KILL的原因）
journalctl -u nginx.service -n 50 --no-pager
# 或
tail -50 /var/log/nginx/error.log
```

### 步骤3：启动Nginx服务

```bash
# 启动Nginx
systemctl start nginx

# 检查状态
systemctl status nginx

# 如果启动失败，查看详细错误
systemctl status nginx --no-pager -l
```

### 步骤4：验证HTTPS访问

```bash
# 测试HTTPS访问
curl -I https://podcasttoinsight.top

# 测试HTTP（应该重定向到HTTPS）
curl -I http://podcasttoinsight.top
```

## 常见问题

### 问题1：Nginx配置错误

**症状**：`nginx -t` 显示配置错误

**解决**：
```bash
# 查看配置错误
nginx -t

# 修复配置后重新加载
systemctl reload nginx
```

### 问题2：端口被占用

**症状**：Nginx启动失败，提示端口被占用

**解决**：
```bash
# 检查80和443端口
netstat -tlnp | grep -E ":80|:443"

# 如果被占用，找出进程并停止
lsof -i :80
lsof -i :443
```

### 问题3：内存不足导致被KILL

**症状**：Nginx被系统KILL（OOM Killer）

**解决**：
```bash
# 检查系统内存
free -h

# 检查系统日志
dmesg | grep -i "killed process" | tail -10
journalctl -k | grep -i "killed" | tail -10

# 如果内存不足，需要：
# 1. 释放内存
# 2. 增加swap空间
# 3. 优化Nginx配置（减少worker进程）
```

### 问题4：SSL证书问题

**症状**：Nginx启动失败，提示SSL证书错误

**解决**：
```bash
# 检查SSL证书
ls -la /etc/letsencrypt/live/podcasttoinsight.top/

# 检查证书是否过期
openssl x509 -in /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem -noout -dates

# 如果证书过期，更新证书
certbot renew
```

## 快速修复命令

```bash
# 1. 检查配置
nginx -t

# 2. 启动Nginx
systemctl start nginx

# 3. 检查状态
systemctl status nginx

# 4. 测试访问
curl -I https://podcasttoinsight.top
```

