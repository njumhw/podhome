# 检查监控进程并解决端口冲突

## 第一步：检查监控进程是否占用 3005

```bash
# 检查这些 watcher.js 进程是否占用 3005
lsof -p 1667084 | grep 3005
lsof -p 1680024 | grep 3005

# 或者检查它们监听的端口
netstat -tlnp | grep -E "1667084|1680024"
ss -tlnp | grep -E "1667084|1680024"
```

如果这些进程**不占用 3005**，那它们不是问题，可以忽略。

## 第二步：检查是否有 systemd 服务自动启动应用

```bash
# 检查是否有相关服务
systemctl list-units | grep -E "podroom|next|node|watcher"

# 检查服务状态
systemctl status watcher 2>/dev/null
systemctl status podroom 2>/dev/null
```

## 解决方案选项

### 方案 A：让应用使用其他端口（推荐）

如果监控进程必须使用 3005，我们可以让应用使用其他端口（如 3006）。

#### 1. 修改应用端口

```bash
cd /opt/podroom

# 编辑 ecosystem.config.js
nano ecosystem.config.js

# 将 PORT: 3005 改为 PORT: 3006
# 保存并退出（Ctrl+X, Y, Enter）
```

#### 2. 修改 Nginx 配置

```bash
# 编辑 Nginx 配置
sudo nano /etc/nginx/sites-available/podroom

# 将 proxy_pass http://localhost:3005; 改为 proxy_pass http://localhost:3006;
# 保存并退出

# 测试配置
sudo nginx -t

# 重新加载 Nginx
sudo systemctl reload nginx
```

#### 3. 重启应用

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

### 方案 B：停止监控进程（如果它们不是必需的）

```bash
# 1. 检查这些进程是什么
cat /var/tmp/watcher.js | head -20

# 2. 检查是否有 systemd 服务管理它们
systemctl list-units | grep watcher
systemctl status watcher 2>/dev/null

# 3. 如果确认可以停止，kill 它们
kill -9 1667084
kill -9 1680024

# 4. 如果有 systemd 服务，停止并禁用
# systemctl stop watcher
# systemctl disable watcher
```

### 方案 C：检查实际占用端口的进程

```bash
# 在应用启动时立即检查
pm2 start ecosystem.config.js --env production
sleep 2
lsof -i :3005 | grep LISTEN
netstat -tlnp | grep :3005

# 查看是哪个进程在占用
# 如果是应用本身，说明启动成功
# 如果是其他进程，记录 PID 并处理
```

## 推荐方案

**推荐使用方案 A（换端口）**，因为：
1. 不会影响系统监控进程
2. 更安全，避免冲突
3. 只需要修改两个文件（ecosystem.config.js 和 Nginx 配置）

