#!/bin/bash

# 服务器安全加固一键设置脚本

echo "=========================================="
echo "服务器安全加固设置"
echo "=========================================="
echo ""

# 1. 检查Fail2ban状态
echo "【1】检查Fail2ban状态..."
if ! command -v fail2ban-client &> /dev/null; then
    echo "⚠️  Fail2ban未安装，正在安装..."
    sudo apt-get update
    sudo apt-get install -y fail2ban
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    echo "✅ Fail2ban已安装并启动"
else
    echo "✅ Fail2ban已安装"
    # 检查运行状态
    if systemctl is-active --quiet fail2ban; then
        echo "✅ Fail2ban正在运行"
        sudo fail2ban-client status | head -5
    else
        echo "⚠️  Fail2ban未运行，正在启动..."
        sudo systemctl start fail2ban
        sudo systemctl enable fail2ban
    fi
fi

# 2. 配置Fail2ban（如果配置文件不存在）
echo ""
echo "【2】检查Fail2ban配置..."
if [ ! -f /etc/fail2ban/jail.local ]; then
    echo "⚠️  配置文件不存在，正在创建..."
    sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
    echo "✅ Fail2ban配置文件已创建"
    echo "   建议手动编辑 /etc/fail2ban/jail.local 优化配置"
else
    echo "✅ Fail2ban配置文件已存在"
    # 检查SSH jail是否启用
    if sudo fail2ban-client status sshd &>/dev/null; then
        echo "✅ SSH jail已启用"
        sudo fail2ban-client status sshd | grep -E "Status|Banned IP"
    else
        echo "⚠️  SSH jail未启用，建议检查配置"
    fi
fi

# 3. 安装UFW防火墙
echo ""
echo "【3】安装UFW防火墙..."
if ! command -v ufw &> /dev/null; then
    sudo apt-get install -y ufw
    echo "✅ UFW已安装"
else
    echo "✅ UFW已安装"
fi

# 4. 配置防火墙规则（不自动启用，需要手动确认）
echo ""
echo "【4】防火墙配置..."
echo "⚠️  防火墙规则需要手动配置，执行以下命令："
echo "   sudo ufw allow 22/tcp    # SSH"
echo "   sudo ufw allow 80/tcp     # HTTP"
echo "   sudo ufw allow 443/tcp    # HTTPS"
echo "   sudo ufw enable           # 启用防火墙"

# 5. 创建安全检查脚本
echo ""
echo "【5】创建安全检查脚本..."
cd /opt/podroom
mkdir -p scripts logs

cat > scripts/security-check.sh << 'SECURITY_EOF'
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

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 安全检查完成" >> "$LOG_FILE"
SECURITY_EOF

chmod +x scripts/security-check.sh
echo "✅ 安全检查脚本已创建"

# 6. 添加到crontab
echo ""
echo "【6】设置定时任务..."
(crontab -l 2>/dev/null | grep -v "security-check.sh"; echo "0 2 * * * /opt/podroom/scripts/security-check.sh") | crontab -
echo "✅ 安全检查已添加到crontab（每天凌晨2点执行）"

# 7. 显示当前crontab
echo ""
echo "=========================================="
echo "当前crontab配置："
echo "=========================================="
crontab -l

echo ""
echo "=========================================="
echo "设置完成！"
echo "=========================================="
echo ""
echo "【下一步操作】"
echo "1. 配置防火墙（手动执行）："
echo "   sudo ufw allow 22/tcp"
echo "   sudo ufw allow 80/tcp"
echo "   sudo ufw allow 443/tcp"
echo "   sudo ufw enable"
echo ""
echo "2. 检查Fail2ban状态："
echo "   sudo fail2ban-client status"
echo ""
echo "3. 查看安全检查日志："
echo "   tail -f /opt/podroom/logs/security-check.log"
echo ""
echo "4. 更改root密码（如果还没改）："
echo "   passwd"
echo ""
echo "5. 配置SSH密钥（推荐）："
echo "   在本地执行: ssh-keygen -t rsa -b 4096"
echo "   然后: ssh-copy-id root@your.server.ip"

