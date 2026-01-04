#!/bin/bash

# 快速检查安全状态脚本

echo "=========================================="
echo "安全状态快速检查"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# 1. Fail2ban状态
echo "【1】Fail2ban状态："
if command -v fail2ban-client &> /dev/null; then
    if systemctl is-active --quiet fail2ban; then
        echo "✅ Fail2ban正在运行"
        echo "   状态："
        sudo fail2ban-client status | head -3
        echo ""
        if sudo fail2ban-client status sshd &>/dev/null; then
            echo "   SSH jail状态："
            sudo fail2ban-client status sshd | grep -E "Status|Banned IP|Currently failed"
        fi
    else
        echo "⚠️  Fail2ban未运行"
        echo "   执行: sudo systemctl start fail2ban"
    fi
else
    echo "⚠️  Fail2ban未安装"
    echo "   执行: sudo apt-get install -y fail2ban"
fi
echo ""

# 2. 防火墙状态
echo "【2】防火墙状态："
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | head -1)
    if echo "$UFW_STATUS" | grep -q "active"; then
        echo "✅ 防火墙已启用"
        echo "   规则："
        ufw status numbered | head -10
    else
        echo "⚠️  防火墙未启用"
        echo "   执行: sudo ufw enable"
    fi
else
    echo "⚠️  UFW未安装"
    echo "   执行: sudo apt-get install -y ufw"
fi
echo ""

# 3. SSH配置检查
echo "【3】SSH配置检查："
SSH_CONFIG="/etc/ssh/sshd_config"
if [ -f "$SSH_CONFIG" ]; then
    if grep -q "^PermitRootLogin no" "$SSH_CONFIG"; then
        echo "✅ Root登录已禁用"
    elif grep -q "^PermitRootLogin prohibit-password" "$SSH_CONFIG"; then
        echo "✅ Root登录仅允许密钥"
    else
        echo "⚠️  Root登录可能允许密码（建议禁用）"
    fi
    
    if grep -q "^PasswordAuthentication no" "$SSH_CONFIG"; then
        echo "✅ 密码认证已禁用"
    else
        echo "⚠️  密码认证已启用（建议禁用，使用SSH密钥）"
    fi
    
    SSH_PORT=$(grep "^Port" "$SSH_CONFIG" | awk '{print $2}' | head -1)
    if [ -n "$SSH_PORT" ] && [ "$SSH_PORT" != "22" ]; then
        echo "✅ SSH端口已更改: $SSH_PORT"
    else
        echo "⚠️  SSH使用默认端口22（建议更改）"
    fi
else
    echo "⚠️  无法读取SSH配置文件"
fi
echo ""

# 4. 可疑进程检查
echo "【4】可疑进程检查："
SUSPICIOUS=$(ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep)
if [ -z "$SUSPICIOUS" ]; then
    echo "✅ 未发现可疑进程"
else
    echo "⚠️  发现可疑进程："
    echo "$SUSPICIOUS"
fi
echo ""

# 5. 配置文件检查
echo "【5】配置文件检查："
MALICIOUS=$(grep -l "\.update\|while true.*done" /etc/profile /root/.bashrc /etc/bash.bashrc 2>/dev/null)
if [ -z "$MALICIOUS" ]; then
    echo "✅ 配置文件干净"
else
    echo "⚠️  发现配置文件被篡改："
    echo "$MALICIOUS"
fi
echo ""

# 6. 定时任务检查
echo "【6】定时任务检查："
SUSPICIOUS_CRON=$(crontab -l 2>/dev/null | grep -E "weball|12323|\.update")
if [ -z "$SUSPICIOUS_CRON" ]; then
    echo "✅ 定时任务正常"
    echo "   当前定时任务："
    crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" | head -5 || echo "   无定时任务"
else
    echo "⚠️  发现可疑定时任务："
    echo "$SUSPICIOUS_CRON"
fi
echo ""

# 7. SSH登录失败记录
echo "【7】SSH登录失败记录（最近10条）："
if [ -f /var/log/auth.log ]; then
    FAILED=$(grep "Failed password" /var/log/auth.log 2>/dev/null | tail -5)
    if [ -n "$FAILED" ]; then
        echo "⚠️  最近有登录失败记录："
        echo "$FAILED" | awk '{print $1, $2, $3, $11, $13}' | head -5
    else
        echo "✅ 最近无登录失败记录"
    fi
else
    echo "⚠️  无法读取认证日志"
fi
echo ""

# 8. 系统资源
echo "【8】系统资源："
echo "   CPU使用率: $(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{printf "%.1f%%\n", 100 - $1}')"
echo "   内存使用: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "   系统负载: $(uptime | awk -F'load average:' '{print $2}')"
echo ""

echo "=========================================="
echo "检查完成"
echo "=========================================="
echo ""
echo "【建议操作】"
echo "1. 如果Fail2ban未运行: sudo systemctl start fail2ban"
echo "2. 如果防火墙未启用: sudo ufw enable"
echo "3. 如果发现可疑进程: 执行清理脚本"
echo "4. 查看详细日志: tail -f /opt/podroom/logs/security-check.log"

