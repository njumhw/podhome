# 端口冲突诊断

## 问题现象

- PM2 日志显示 `EADDRINUSE: address already in use :::3005`
- 但网页端（3005 和 podcasttoinsight.top）都可以正常访问

## 可能的原因

1. **多个 Node.js 进程**：可能有多个进程在运行，其中一个占用了 3005
2. **Nginx 代理**：Nginx 可能代理到其他端口，实际应用不在 3005
3. **PM2 进程冲突**：可能有多个 PM2 进程，其中一个崩溃重启，另一个正常运行

## 诊断步骤

### 1. 检查所有 Node.js 进程

```bash
ps aux | grep node
```

查看所有 Node.js 进程，确认是否有多个进程。

### 2. 检查所有端口占用

```bash
# 检查 3005 端口
lsof -i :3005

# 检查其他常用端口
lsof -i :3000
lsof -i :3001
lsof -i :3002
```

### 3. 检查 Nginx 配置

```bash
cat /etc/nginx/sites-available/podroom
```

查看 Nginx 实际代理到哪个端口。

### 4. 检查所有 PM2 进程

```bash
pm2 list
pm2 describe podroom
```

查看 PM2 进程的详细信息。

### 5. 检查实际运行的应用

```bash
# 查看 Nginx 访问日志
tail -f /var/log/nginx/access.log

# 或者直接访问应用，查看响应头
curl -I http://localhost:3005
```

## 解决方案

根据诊断结果，可能需要：
1. 停止重复的进程
2. 统一端口配置
3. 修复 PM2 配置

