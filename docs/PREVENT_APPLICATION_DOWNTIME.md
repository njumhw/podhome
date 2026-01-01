# 预防应用无缘无故下线 - 完整方案

## 📋 问题回顾

你遇到过几次应用无缘无故下线的情况，主要原因：
1. **恶意脚本注入**：`/etc/profile` 被注入恶意脚本
2. **Nginx被KILL**：系统OOM Killer或手动KILL导致Nginx停止
3. **应用异常退出**：PM2应用可能因为各种原因停止

## 🛡️ 完整预防方案

### 方案1：自动监控和恢复（推荐）

#### 1.1 设置监控脚本

```bash
cd /opt/podroom
git pull origin main
chmod +x scripts/setup-monitoring.sh
./scripts/setup-monitoring.sh
```

这个脚本会：
- ✅ 创建应用监控脚本（每5分钟检查一次）
- ✅ 设置Nginx自动重启
- ✅ 设置PM2开机自启
- ✅ 创建安全检查脚本（每天检查一次）

#### 1.2 监控内容

监控脚本会自动检查：
- PM2应用状态
- 端口监听状态
- Nginx服务状态
- 本地和HTTPS访问
- 恶意脚本检测
- 系统资源使用

#### 1.3 自动恢复

如果检测到问题，会自动：
- 重启PM2应用
- 启动Nginx服务
- 记录日志

---

### 方案2：Nginx自动重启配置

#### 2.1 设置systemd自动重启

```bash
# 创建override配置
mkdir -p /etc/systemd/system/nginx.service.d
cat > /etc/systemd/system/nginx.service.d/override.conf <<EOF
[Service]
Restart=always
RestartSec=5
StartLimitInterval=0
EOF

# 重新加载systemd
systemctl daemon-reload

# 验证配置
systemctl cat nginx.service
```

这样Nginx如果被KILL，会自动在5秒后重启。

---

### 方案3：PM2自动重启和开机自启

#### 3.1 设置PM2开机自启

```bash
# 生成启动脚本
pm2 startup

# 保存当前进程列表
pm2 save
```

#### 3.2 配置PM2自动重启

编辑 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'podroom',
    script: './.next/standalone/server.js',
    instances: 1,
    exec_mode: 'cluster',
    autorestart: true,  // 自动重启
    max_restarts: 10,   // 最大重启次数
    min_uptime: '10s',  // 最小运行时间
    max_memory_restart: '1G',  // 内存超限重启
    error_file: '/var/log/podroom/err.log',
    out_file: '/var/log/podroom/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
```

---

### 方案4：安全加固

#### 4.1 定期检查配置文件

创建定期检查脚本：

```bash
# 每天检查一次配置文件
0 2 * * * /opt/podroom/scripts/security-check.sh
```

#### 4.2 检查SSH安全

```bash
# 1. 禁用root密码登录（使用密钥）
# 编辑 /etc/ssh/sshd_config
PermitRootLogin prohibit-password
PasswordAuthentication no

# 2. 更改SSH端口（可选）
Port 2222

# 3. 重启SSH
systemctl restart sshd
```

#### 4.3 安装fail2ban（防止暴力破解）

```bash
# 安装fail2ban
apt update
apt install -y fail2ban

# 配置fail2ban
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
EOF

# 启动fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

---

### 方案5：日志监控和告警

#### 5.1 设置日志轮转

```bash
# 创建logrotate配置
cat > /etc/logrotate.d/podroom <<EOF
/var/log/podroom/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF
```

#### 5.2 监控关键日志

```bash
# 监控应用错误日志
tail -f /var/log/podroom/err.log | grep -i "error\|fatal\|crash"

# 监控Nginx错误日志
tail -f /var/log/nginx/error.log
```

---

### 方案6：系统资源监控

#### 6.1 监控内存使用

```bash
# 如果内存不足，Nginx可能被OOM Killer杀掉
# 设置swap空间（如果还没有）
swapon --show

# 如果swap不足，可以增加
# 但更好的方案是升级服务器内存
```

#### 6.2 监控磁盘空间

```bash
# 定期检查磁盘空间
df -h

# 清理日志和临时文件
find /var/log -name "*.log" -mtime +30 -delete
find /tmp -type f -mtime +7 -delete
```

---

## 🚀 快速设置（一键执行）

```bash
cd /opt/podroom
git pull origin main

# 设置监控和自动恢复
chmod +x scripts/setup-monitoring.sh
./scripts/setup-monitoring.sh

# 设置Nginx自动重启
mkdir -p /etc/systemd/system/nginx.service.d
cat > /etc/systemd/system/nginx.service.d/override.conf <<EOF
[Service]
Restart=always
RestartSec=5
StartLimitInterval=0
EOF
systemctl daemon-reload

# 设置PM2开机自启
pm2 startup
pm2 save

# 验证
systemctl status nginx
pm2 list
crontab -l
```

---

## 📊 监控日志位置

- **应用监控日志**：`/var/log/podroom-monitor.log`
- **安全检查日志**：`/var/log/podroom-security.log`
- **应用错误日志**：`/var/log/podroom/err.log`
- **应用输出日志**：`/var/log/podroom/out.log`
- **Nginx错误日志**：`/var/log/nginx/error.log`

---

## 🔍 定期检查清单

### 每天检查
- [ ] 查看监控日志：`tail -50 /var/log/podroom-monitor.log`
- [ ] 检查应用状态：`pm2 list`
- [ ] 检查Nginx状态：`systemctl status nginx`

### 每周检查
- [ ] 查看安全日志：`tail -50 /var/log/podroom-security.log`
- [ ] 检查系统资源：`free -h && df -h`
- [ ] 检查SSH登录：`tail -50 /var/log/auth.log | grep "Failed"`

### 每月检查
- [ ] 更新系统：`apt update && apt upgrade -y`
- [ ] 检查磁盘空间：`df -h`
- [ ] 检查定时任务：`crontab -l`

---

## ⚠️ 紧急恢复流程

如果应用再次下线，按以下步骤：

```bash
# 1. 检查PM2状态
pm2 list
pm2 logs podroom --lines 50 --nostream

# 2. 检查Nginx状态
systemctl status nginx
tail -50 /var/log/nginx/error.log

# 3. 检查端口
netstat -tlnp | grep -E ":3005|:80|:443"

# 4. 重启服务
pm2 restart podroom
systemctl start nginx

# 5. 验证访问
curl -I https://podcasttoinsight.top/home
```

---

## 📝 总结

通过以上方案，你可以：
1. ✅ **自动监控**：每5分钟自动检查应用和Nginx状态
2. ✅ **自动恢复**：发现问题自动重启服务
3. ✅ **安全防护**：每天检查恶意脚本和异常登录
4. ✅ **日志记录**：所有操作都有日志记录
5. ✅ **开机自启**：服务器重启后自动启动应用

这样即使出现问题，系统也会自动恢复，大大减少人工干预的需要。

