# 服务器安全加固指南

## 目标

防止服务器被入侵、CPU被恶意占用、配置文件被篡改等问题。

---

## 一、SSH安全加固（最重要）

### 1. 更改SSH端口（降低被扫描概率）

```bash
# 编辑SSH配置
sudo nano /etc/ssh/sshd_config

# 修改以下配置：
# Port 22 改为 Port 2222（或其他端口，如 22222）
Port 2222

# 保存后重启SSH服务
sudo systemctl restart sshd

# ⚠️ 注意：修改端口前确保新端口已开放防火墙，否则会无法连接
```

### 2. 禁用root密码登录（推荐使用SSH密钥）

```bash
# 编辑SSH配置
sudo nano /etc/ssh/sshd_config

# 修改以下配置：
PermitRootLogin no              # 禁止root直接登录
PasswordAuthentication no       # 禁用密码登录（如果已配置SSH密钥）
PubkeyAuthentication yes        # 启用密钥认证

# 保存后重启SSH服务
sudo systemctl restart sshd

# ⚠️ 注意：确保已配置SSH密钥，否则会无法登录
```

### 3. 限制SSH登录IP（如果IP固定）

```bash
# 编辑SSH配置
sudo nano /etc/ssh/sshd_config

# 添加允许的IP（例如只允许特定IP登录）
AllowUsers admin@your.ip.address
# 或
AllowUsers admin@192.168.1.*

# 保存后重启SSH服务
sudo systemctl restart sshd
```

### 4. 配置SSH密钥（如果还没有）

```bash
# 在本地生成密钥对（如果还没有）
ssh-keygen -t rsa -b 4096

# 将公钥复制到服务器
ssh-copy-id -p 22 root@your.server.ip

# 或手动复制
cat ~/.ssh/id_rsa.pub | ssh -p 22 root@your.server.ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

---

## 二、安装Fail2ban（防止暴力破解）

### 1. 安装Fail2ban

```bash
sudo apt-get update
sudo apt-get install -y fail2ban

# 启动并设置开机自启
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 检查状态
sudo fail2ban-client status
```

### 2. 配置Fail2ban

```bash
# 创建本地配置文件
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# 编辑配置
sudo nano /etc/fail2ban/jail.local

# 修改以下配置：
[DEFAULT]
bantime = 3600          # 封禁时间（秒），1小时
findtime = 600          # 时间窗口（秒），10分钟
maxretry = 5            # 最大尝试次数

[sshd]
enabled = true
port = 22,2222          # 根据你的SSH端口调整
maxretry = 3            # SSH最大尝试次数（更严格）

# 保存后重启Fail2ban
sudo systemctl restart fail2ban

# 查看SSH jail状态
sudo fail2ban-client status sshd
```

### 3. 查看被封禁的IP

```bash
# 查看所有jail状态
sudo fail2ban-client status

# 查看SSH jail的封禁IP
sudo fail2ban-client status sshd
```

---

## 三、防火墙配置（UFW）

### 1. 安装和配置UFW

```bash
# 安装UFW
sudo apt-get install -y ufw

# 设置默认策略
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许SSH（根据你的端口调整）
sudo ufw allow 22/tcp
# 或
sudo ufw allow 2222/tcp

# 允许HTTP和HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status verbose
```

### 2. 限制Nginx访问（可选，防止扫描）

```bash
# 只允许特定IP访问管理接口（如果有）
sudo ufw allow from your.ip.address to any port 80
sudo ufw allow from your.ip.address to any port 443
```

---

## 四、定期安全检查脚本

### 1. 创建安全检查脚本

```bash
cd /opt/podroom

cat > scripts/security-check.sh << 'EOF'
#!/bin/bash

LOG_FILE="/opt/podroom/logs/security-check.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始安全检查..." >> "$LOG_FILE"

# 1. 检查可疑进程
SUSPICIOUS=$(ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep)
if [ -n "$SUSPICIOUS" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 发现可疑进程！" >> "$LOG_FILE"
    echo "$SUSPICIOUS" >> "$LOG_FILE"
    echo "$SUSPICIOUS" | awk '{print $2}' | xargs -r kill -9 2>/dev/null
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 已自动清理可疑进程" >> "$LOG_FILE"
fi

# 2. 检查配置文件中的恶意代码
MALICIOUS_FILES=$(grep -l "\.update\|while true.*done" /etc/profile /root/.bashrc /etc/bash.bashrc 2>/dev/null)
if [ -n "$MALICIOUS_FILES" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 发现配置文件被篡改！" >> "$LOG_FILE"
    echo "$MALICIOUS_FILES" >> "$LOG_FILE"
    # 自动清理
    sed -i '/\.update/d' /etc/profile /root/.bashrc /etc/bash.bashrc 2>/dev/null
    sed -i '/while true/,/done &/d' /etc/profile /root/.bashrc /etc/bash.bashrc 2>/dev/null
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 已自动清理配置文件" >> "$LOG_FILE"
fi

# 3. 检查可疑文件
SUSPICIOUS_FILES=(
    "/usr/bin/.update"
    "/tmp/x.sh"
    "/tmp/f"
)

for file in "${SUSPICIOUS_FILES[@]}"; do
    if [ -e "$file" ] 2>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 发现可疑文件: $file" >> "$LOG_FILE"
        rm -f "$file" 2>/dev/null
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 已删除可疑文件: $file" >> "$LOG_FILE"
    fi
done

# 4. 检查异常定时任务
SUSPICIOUS_CRON=$(crontab -l 2>/dev/null | grep -E "weball|12323|\.update")
if [ -n "$SUSPICIOUS_CRON" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 发现可疑定时任务！" >> "$LOG_FILE"
    echo "$SUSPICIOUS_CRON" >> "$LOG_FILE"
    crontab -l 2>/dev/null | grep -vE "weball|12323|\.update" | crontab -
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 已清理可疑定时任务" >> "$LOG_FILE"
fi

# 5. 检查SSH登录失败记录
SSH_FAILED=$(grep "Failed password" /var/log/auth.log 2>/dev/null | tail -10)
if [ -n "$SSH_FAILED" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ 最近SSH登录失败记录：" >> "$LOG_FILE"
    echo "$SSH_FAILED" >> "$LOG_FILE"
fi

# 6. 检查系统资源使用
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
if (( $(echo "$CPU_USAGE > 90" | bc -l) )); then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ CPU使用率异常: ${CPU_USAGE}%" >> "$LOG_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 安全检查完成" >> "$LOG_FILE"
EOF

chmod +x scripts/security-check.sh

# 添加到crontab（每天凌晨2点执行）
(crontab -l 2>/dev/null | grep -v "security-check.sh"; echo "0 2 * * * /opt/podroom/scripts/security-check.sh") | crontab -

echo "✅ 安全检查脚本已设置（每天凌晨2点执行）"
```

---

## 五、系统更新和补丁

### 1. 定期更新系统

```bash
# 设置自动更新（可选）
sudo apt-get install -y unattended-upgrades

# 配置自动更新
sudo dpkg-reconfigure -plow unattended-upgrades

# 或手动更新
sudo apt-get update
sudo apt-get upgrade -y
```

### 2. 定期更新应用依赖

```bash
# 在应用目录执行
cd /opt/podroom
npm update
```

---

## 六、监控和告警

### 1. CPU监控（已设置）

```bash
# 每5分钟检查一次CPU使用率
# 已在之前设置，查看日志：
tail -f /opt/podroom/logs/cpu-monitor.log
```

### 2. 应用健康监控

```bash
# 检查是否有监控脚本
ls -la /opt/podroom/scripts/monitor-application.sh

# 如果没有，创建：
cat > scripts/monitor-application.sh << 'EOF'
#!/bin/bash
LOG_FILE="/var/log/podroom-monitor.log"

# 检查PM2进程
if ! pm2 list | grep -q "online"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ PM2进程异常，尝试重启..." >> "$LOG_FILE"
    pm2 restart all
fi

# 检查Nginx
if ! systemctl is-active --quiet nginx; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Nginx未运行，尝试启动..." >> "$LOG_FILE"
    systemctl start nginx
fi
EOF

chmod +x scripts/monitor-application.sh

# 添加到crontab（每5分钟执行一次）
(crontab -l 2>/dev/null | grep -v "monitor-application.sh"; echo "*/5 * * * * /opt/podroom/scripts/monitor-application.sh >> /var/log/podroom-monitor.log 2>&1") | crontab -
```

---

## 七、应用安全

### 1. 限制Nginx访问（防止扫描）

编辑Nginx配置，添加限流：

```bash
sudo nano /etc/nginx/nginx.conf

# 在 http 块中添加：
limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;

# 在 server 块中添加：
limit_req zone=req_limit_per_ip burst=20 nodelay;
limit_conn conn_limit_per_ip 10;

# 保存后重启Nginx
sudo systemctl restart nginx
```

### 2. 隐藏Nginx版本信息

```bash
sudo nano /etc/nginx/nginx.conf

# 在 http 块中添加：
server_tokens off;

# 保存后重启Nginx
sudo systemctl restart nginx
```

### 3. 定期检查应用日志

```bash
# 查看异常请求
tail -100 /var/log/nginx/access.log | grep -E "\.php|\.env|\.git|\.sql"

# 查看错误日志
tail -50 /var/log/nginx/error.log
```

---

## 八、定期备份

### 1. 创建备份脚本

```bash
cat > scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# 备份应用代码
tar -czf "$BACKUP_DIR/podroom_$DATE.tar.gz" -C /opt podroom --exclude="node_modules" --exclude=".next"

# 备份数据库（如果有）
# pg_dump your_database > "$BACKUP_DIR/db_$DATE.sql"

# 清理7天前的备份
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete

echo "备份完成: $BACKUP_DIR/podroom_$DATE.tar.gz"
EOF

chmod +x scripts/backup.sh

# 添加到crontab（每天凌晨3点执行）
(crontab -l 2>/dev/null | grep -v "backup.sh"; echo "0 3 * * * /opt/podroom/scripts/backup.sh") | crontab -
```

---

## 九、完整的安全检查清单

### 立即执行（一次性）

```bash
# 1. 更改root密码（如果还没改）
passwd

# 2. 安装Fail2ban
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 3. 配置防火墙
sudo apt-get install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 4. 设置SSH密钥（如果还没有）
# 在本地执行：ssh-keygen -t rsa -b 4096
# 然后：ssh-copy-id root@your.server.ip

# 5. 创建所有监控脚本（见上面的脚本）
```

### 定期维护（自动化）

- ✅ CPU监控：每5分钟（已设置）
- ✅ 应用监控：每5分钟（已设置）
- ✅ 安全检查：每天凌晨2点（已设置）
- ✅ 自动备份：每天凌晨3点（可选）

---

## 十、紧急响应流程

如果再次发现CPU飙升或被入侵：

### 1. 立即执行诊断

```bash
cd /opt/podroom
./scripts/diagnose-cpu-spike.sh
```

### 2. 清理恶意代码

```bash
# 终止可疑进程
ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null

# 清理配置文件
sed -i '/\.update/d' /etc/profile /root/.bashrc /etc/bash.bashrc 2>/dev/null
sed -i '/while true/,/done &/d' /etc/profile /root/.bashrc /etc/bash.bashrc 2>/dev/null

# 删除可疑文件
rm -f /usr/bin/.update /tmp/x.sh /tmp/f /tmp/*.sh

# 清理定时任务
crontab -l | grep -vE "weball|12323|\.update" | crontab -
```

### 3. 更改密码和密钥

```bash
# 更改root密码
passwd

# 检查SSH密钥
cat ~/.ssh/authorized_keys

# 如果发现异常密钥，删除并重新配置
```

---

## 十一、监控日志查看

```bash
# CPU监控日志
tail -f /opt/podroom/logs/cpu-monitor.log

# 安全检查日志
tail -f /opt/podroom/logs/security-check.log

# 应用监控日志
tail -f /var/log/podroom-monitor.log

# SSH登录失败记录
grep "Failed password" /var/log/auth.log | tail -20

# Fail2ban状态
sudo fail2ban-client status sshd
```

---

## 总结

### 已完成的防护措施

1. ✅ CPU监控（每5分钟）
2. ✅ 应用监控（每5分钟）
3. ✅ 安全检查脚本（每天）

### 建议立即执行

1. ⚠️ **安装Fail2ban**（防止暴力破解）
2. ⚠️ **配置防火墙UFW**（限制端口访问）
3. ⚠️ **更改SSH端口**（降低被扫描概率）
4. ⚠️ **配置SSH密钥**（禁用密码登录）
5. ⚠️ **设置自动备份**（数据安全）

### 优先级

**高优先级（立即执行）**：
1. 安装Fail2ban
2. 配置防火墙
3. 更改root密码

**中优先级（本周内）**：
1. 更改SSH端口
2. 配置SSH密钥
3. 设置自动备份

**低优先级（可选）**：
1. 限制Nginx访问
2. 系统自动更新
3. 邮件告警（需要配置）

---

执行完这些措施后，服务器安全性会显著提升，大大降低被入侵的概率。

