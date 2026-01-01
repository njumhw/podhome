# 启动Nginx并验证访问

## 当前状态

- ✅ 应用正常运行（PM2 online）
- ✅ HTTPS访问能返回307（说明Nginx在运行）
- ❌ systemd显示Nginx failed（状态不同步）

## 修复步骤

### 步骤1：检查Nginx进程

```bash
# 检查Nginx进程是否在运行
ps aux | grep nginx | grep -v grep

# 检查Nginx端口监听
netstat -tlnp | grep -E ":80|:443"
```

### 步骤2：启动Nginx服务

```bash
# 启动Nginx
systemctl start nginx

# 检查状态
systemctl status nginx
```

### 步骤3：如果启动失败，检查原因

```bash
# 查看详细错误
systemctl status nginx --no-pager -l

# 检查Nginx配置
nginx -t

# 查看Nginx错误日志
tail -50 /var/log/nginx/error.log
```

### 步骤4：检查为什么会被KILL

```bash
# 检查系统日志，看为什么被KILL
journalctl -u nginx.service -n 100 --no-pager | grep -i "kill\|oom\|memory"

# 检查系统内存
free -h

# 检查系统日志中的OOM Killer
dmesg | grep -i "killed\|oom" | tail -20
```

### 步骤5：验证访问

```bash
# 测试HTTPS访问
curl -I https://podcasttoinsight.top

# 测试HTTP（应该重定向到HTTPS）
curl -I http://podcasttoinsight.top

# 测试首页
curl -I https://podcasttoinsight.top/home
```

## 关于 supdate.service

看到有一个 `supdate.service` 服务，需要检查：

```bash
# 检查这个服务
systemctl status supdate.service

# 查看服务文件
systemctl cat supdate.service

# 如果可疑，可以禁用
systemctl disable supdate.service
```

## 如果Nginx持续被KILL

可能是内存不足导致的OOM Killer：

```bash
# 1. 检查内存使用
free -h
top -bn1 | head -20

# 2. 检查swap
swapon --show

# 3. 优化Nginx配置（减少worker进程）
nano /etc/nginx/nginx.conf
# 找到 worker_processes，改为 1 或 2
```

