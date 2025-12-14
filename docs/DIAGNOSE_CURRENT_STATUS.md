# 诊断当前服务器状态

## 当前情况分析

从日志看：
- ✅ 应用在 3006 端口成功启动（`- Local: http://localhost:3006`）
- ✅ Nginx 仍然代理到 3005（所以 `https://podcasttoinsight.top/home` 正常）
- ❓ 3005 端口有服务在运行（可能是监控进程或其他应用）
- ❓ 3006 端口可能被防火墙阻止（所以 `http://47.117.77.211:3006/home` 无法访问）

## 诊断步骤

### 1. 检查 3005 端口上运行的是什么

```bash
# 检查 3005 端口上的进程
lsof -i :3005 | grep LISTEN
netstat -tlnp | grep :3005

# 查看进程详情
# 如果找到 PID，执行：
ps -ef | grep <PID>
pstree -ap <PID>
```

### 2. 检查 3006 端口状态

```bash
# 检查 3006 端口
lsof -i :3006 | grep LISTEN
netstat -tlnp | grep :3006

# 测试本地访问
curl -I http://localhost:3006
curl -I http://localhost:3006/home
```

### 3. 检查 PM2 进程状态

```bash
pm2 list
pm2 describe podroom

# 查看 PM2 进程的端口配置
pm2 env 0 | grep PORT
```

### 4. 检查 Nginx 配置

```bash
# 查看 Nginx 实际代理的端口
cat /etc/nginx/sites-available/podroom | grep proxy_pass

# 测试 Nginx 配置
sudo nginx -t
```

## 解决方案：让应用在 3005 正常运行

### 方案 1：找出并停止占用 3005 的进程

```bash
# 1. 找出占用 3005 的进程
lsof -i :3005 | grep LISTEN
# 或
netstat -tlnp | grep :3005

# 2. 记录 PID，检查是什么进程
ps -ef | grep <PID>

# 3. 如果是监控进程或其他非必需进程，停止它
kill -9 <PID>

# 4. 确认端口已释放
lsof -i :3005

# 5. 修改应用端口回 3005
cd /opt/podroom
nano ecosystem.config.js
# 将 PORT: 3006 改回 PORT: 3005

# 6. 重启应用
pm2 restart podroom
# 或
pm2 delete podroom
pm2 start ecosystem.config.js --env production
```

### 方案 2：如果 3005 上的服务是必需的

如果 3005 上的服务不能停止（比如是系统监控），我们需要：

1. **找出这个服务是什么**
2. **让它使用其他端口**
3. **或者让应用使用其他端口，并更新 Nginx**

但根据你的需求，应用必须在 3005，所以需要停止占用 3005 的服务。

