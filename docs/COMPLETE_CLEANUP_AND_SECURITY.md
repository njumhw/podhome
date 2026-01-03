# 完整清理和安全加固指南

## ✅ 当前状态

- ✅ 恶意进程已清理
- ✅ 配置文件已清理
- ✅ CPU占用恢复正常

## 🔧 完成清理步骤

### 步骤1：验证配置文件已清理

```bash
# 检查是否还有残留
grep -n "\.update" /etc/profile /root/.bashrc 2>/dev/null

# 如果还有，查看具体内容
sed -n '30,40p' /etc/profile
sed -n '5,15p' /root/.bashrc
```

### 步骤2：重新加载配置（或重新登录）

```bash
# 方法1：重新加载配置
source /etc/profile
source /root/.bashrc

# 方法2：退出重新登录（推荐）
exit
# 然后重新SSH登录
```

### 步骤3：检查是否还有其他后门

```bash
# 1. 检查所有定时任务
crontab -l
cat /etc/crontab | grep -v "^#"
ls -la /etc/cron.d/
ls -la /etc/cron.hourly/
ls -la /etc/cron.daily/

# 2. 检查系统服务
systemctl list-units --type=service --all | grep -E "weball|update|\.sh"

# 3. 检查可疑文件
find /tmp -name "*.sh" -mtime -1
find /usr/bin -name ".*" -type f
find /var/tmp -name ".*" -type f

# 4. 检查网络连接
netstat -tulnp | grep ESTABLISHED

# 5. 检查SSH登录
tail -50 /var/log/auth.log | grep -E "Failed|Accepted"
```

### 步骤4：检查应用状态

```bash
# 检查PM2状态
pm2 list

# 检查应用日志
pm2 logs podroom --lines 20 --nostream

# 检查Nginx状态
systemctl status nginx

# 测试访问
curl -I https://podcasttoinsight.top/home
```

## 🔒 安全加固（重要！）

### 1. 更改所有密码

```bash
# 更改root密码
passwd

# 如果使用其他用户，也要更改
# passwd username
```

### 2. 检查SSH密钥

```bash
# 检查authorized_keys
cat ~/.ssh/authorized_keys

# 如果发现不认识的密钥，删除它
# nano ~/.ssh/authorized_keys
```

### 3. 加强SSH安全

```bash
# 编辑SSH配置
nano /etc/ssh/sshd_config

# 建议修改：
# PermitRootLogin prohibit-password  # 禁用密码登录，只允许密钥
# PasswordAuthentication no  # 禁用密码认证
# Port 2222  # 更改SSH端口（可选）

# 重启SSH
systemctl restart sshd
```

### 4. 安装fail2ban

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
systemctl status fail2ban
```

### 5. 设置防火墙

```bash
# 检查防火墙状态
ufw status

# 如果未启用，设置基本规则
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 6. 定期检查脚本

```bash
# 设置定期检查（每天凌晨2点）
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/podroom/scripts/security-check.sh") | crontab -
```

## 📊 验证清理结果

```bash
# 1. 重新登录后，不应该再看到 .update 错误

# 2. 检查CPU占用（应该正常）
ps aux --sort=-%cpu | head -6

# 3. 检查恶意进程（应该没有）
ps aux | grep -E "weball|12323|\.update" | grep -v grep

# 4. 检查配置文件（应该干净）
grep -n "\.update" /etc/profile /root/.bashrc 2>/dev/null || echo "✅ 干净"

# 5. 检查网络连接（应该没有可疑连接）
netstat -tulnp | grep -E "94.154.35.154|193.142.147.209" || echo "✅ 无可疑连接"
```

## ⚠️ 重要提醒

1. **立即更改密码**：服务器可能已被入侵，密码可能泄露
2. **检查SSH密钥**：确保只有你信任的密钥
3. **监控系统**：设置监控脚本，定期检查
4. **更新系统**：定期更新系统和应用
5. **备份数据**：定期备份重要数据

## 🚀 后续预防

1. **设置监控**：运行 `./scripts/setup-monitoring.sh`
2. **定期检查**：每周检查系统日志和进程
3. **安全更新**：及时更新系统和应用
4. **强密码**：使用强密码和SSH密钥
5. **限制访问**：只允许必要的端口和服务

