# 服务器入侵诊断和修复指南

## 🚨 问题症状

从监控数据看：
- **CPU使用率100%**：从04:30开始持续100%
- **安全告警**：Next.js/React Server Components远程代码执行漏洞
- **可能原因**：恶意脚本、挖矿程序、后门程序

## 🔍 立即诊断步骤

### 步骤1：运行诊断脚本

```bash
cd /opt/podroom
git pull origin main
chmod +x scripts/diagnose-server-intrusion.sh
./scripts/diagnose-server-intrusion.sh > /tmp/intrusion-report.txt 2>&1
cat /tmp/intrusion-report.txt
```

### 步骤2：快速检查CPU占用

```bash
# 查看CPU占用最高的进程
top -bn1 | head -20

# 或使用
ps aux --sort=-%cpu | head -11
```

### 步骤3：检查可疑进程

```bash
# 检查包含可疑关键词的进程
ps aux | grep -E "\.update|\.sh|wget|curl|miner|mine|xmrig|stratum" | grep -v grep

# 检查CPU占用超过50%的进程
ps aux | awk '$3 > 50 {print $0}'
```

### 步骤4：检查网络连接

```bash
# 检查异常网络连接
netstat -tulnp | grep ESTABLISHED

# 检查监听端口
netstat -tulnp | grep LISTEN

# 检查连接到可疑IP的进程
netstat -tulnp | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn
```

## 🛠️ 修复步骤

### 方案1：终止恶意进程（如果确认是恶意程序）

```bash
# 1. 找到CPU占用最高的进程PID
TOP_PID=$(ps aux --sort=-%cpu | head -2 | tail -1 | awk '{print $2}')

# 2. 查看进程详情
ps -fp $TOP_PID

# 3. 如果确认是恶意进程，终止它
kill -9 $TOP_PID

# 4. 检查是否还有相关进程
ps aux | grep -E "进程名" | grep -v grep
```

### 方案2：清理恶意脚本

```bash
# 1. 检查并清理 /etc/profile
sed -i '/\.update/d' /etc/profile
sed -i '/while true.*startup/d' /etc/profile

# 2. 检查并清理 /root/.bashrc
sed -i '/\.update/d' /root/.bashrc
sed -i '/while true.*startup/d' /root/.bashrc

# 3. 检查定时任务
crontab -l | grep -v "\.update" | crontab -

# 4. 检查系统定时任务
grep -r "\.update" /etc/cron.* 2>/dev/null
```

### 方案3：清理可疑文件

```bash
# 1. 查找可疑文件
find /usr/bin -name ".*" -type f 2>/dev/null
find /tmp -name ".*" -type f -mtime -7 2>/dev/null

# 2. 如果确认是恶意文件，删除
# rm -f /path/to/malicious/file
```

### 方案4：修复Next.js漏洞

```bash
# 1. 检查Next.js版本
cd /opt/podroom
cat package.json | grep "next"

# 2. 更新到安全版本
npm update next react react-dom

# 3. 重新构建
rm -rf .next
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 4. 重启应用
pm2 restart podroom
```

## 🔒 安全加固

### 1. 立即执行

```bash
# 1. 更改SSH密码（如果使用密码登录）
passwd

# 2. 检查SSH配置
grep -E "PermitRootLogin|PasswordAuthentication" /etc/ssh/sshd_config

# 3. 检查最近登录
last | head -20
tail -50 /var/log/auth.log | grep -E "Failed|Accepted"
```

### 2. 安装安全工具

```bash
# 安装fail2ban（防止暴力破解）
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

systemctl enable fail2ban
systemctl start fail2ban
```

### 3. 设置防火墙

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

## 📊 快速诊断命令（一键执行）

```bash
# 完整诊断
cd /opt/podroom && \
echo "=== CPU占用Top 5 ===" && \
ps aux --sort=-%cpu | head -6 && \
echo "" && \
echo "=== 可疑进程 ===" && \
ps aux | grep -E "\.update|\.sh|miner|mine" | grep -v grep && \
echo "" && \
echo "=== 网络连接 ===" && \
netstat -tulnp | grep ESTABLISHED | head -10 && \
echo "" && \
echo "=== 定时任务 ===" && \
crontab -l 2>/dev/null && \
echo "" && \
echo "=== 系统资源 ===" && \
free -h && uptime
```

## ⚠️ 紧急处理流程

如果确认服务器被入侵：

1. **立即终止恶意进程**
   ```bash
   # 找到并终止
   ps aux --sort=-%cpu | head -2 | tail -1
   kill -9 <PID>
   ```

2. **清理恶意脚本**
   ```bash
   sed -i '/\.update/d' /etc/profile /root/.bashrc
   ```

3. **检查并清理定时任务**
   ```bash
   crontab -l > /tmp/cron.backup
   crontab -r  # 清空（谨慎！）
   # 然后手动添加需要的任务
   ```

4. **更改所有密码**
   ```bash
   passwd
   # 如果使用密钥，检查 ~/.ssh/authorized_keys
   ```

5. **检查系统完整性**
   ```bash
   # 检查关键文件是否被修改
   ls -la /etc/passwd /etc/shadow
   ```

## 📝 预防措施

1. **定期检查**
   - 每天检查CPU和内存使用
   - 每周检查系统日志
   - 每月检查定时任务

2. **监控告警**
   - 设置CPU使用率告警（>80%）
   - 设置异常进程告警
   - 设置SSH登录失败告警

3. **安全更新**
   - 定期更新系统和应用
   - 及时修复安全漏洞
   - 使用最新版本的Next.js

