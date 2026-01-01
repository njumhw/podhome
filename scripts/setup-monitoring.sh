#!/bin/bash

# 设置监控和自动恢复

echo "=========================================="
echo "设置应用监控和自动恢复"
echo "=========================================="
echo ""

# 1. 创建监控脚本
MONITOR_SCRIPT="/opt/podroom/scripts/monitor-application.sh"
chmod +x "$MONITOR_SCRIPT"
echo "✅ 监控脚本已创建: $MONITOR_SCRIPT"

# 2. 设置定时任务（每5分钟检查一次）
CRON_JOB="*/5 * * * * $MONITOR_SCRIPT >> /var/log/podroom-monitor.log 2>&1"

# 检查是否已存在
if crontab -l 2>/dev/null | grep -q "monitor-application.sh"; then
    echo "⚠️  监控任务已存在，跳过添加"
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ 已添加定时监控任务（每5分钟检查一次）"
fi

# 3. 设置Nginx自动重启
NGINX_OVERRIDE="/etc/systemd/system/nginx.service.d/override.conf"
mkdir -p "$(dirname "$NGINX_OVERRIDE")"

if [ ! -f "$NGINX_OVERRIDE" ]; then
    cat > "$NGINX_OVERRIDE" <<EOF
[Service]
Restart=always
RestartSec=5
StartLimitInterval=0
EOF
    systemctl daemon-reload
    echo "✅ 已设置Nginx自动重启"
else
    echo "⚠️  Nginx自动重启配置已存在"
fi

# 4. 设置PM2开机自启
pm2 startup
pm2 save
echo "✅ 已设置PM2开机自启"

# 5. 创建安全检查脚本
SECURITY_SCRIPT="/opt/podroom/scripts/security-check.sh"
cat > "$SECURITY_SCRIPT" <<'EOF'
#!/bin/bash
# 安全检查脚本

LOG_FILE="/var/log/podroom-security.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查恶意脚本
check_malicious() {
    local found=0
    
    # 检查 /etc/profile
    if grep -q "\.update\|while true.*startup" /etc/profile 2>/dev/null; then
        log "⚠️  检测到 /etc/profile 中有可疑脚本！"
        found=1
    fi
    
    # 检查 .bashrc
    if [ -f /root/.bashrc ] && grep -q "\.update\|while true.*startup" /root/.bashrc 2>/dev/null; then
        log "⚠️  检测到 /root/.bashrc 中有可疑脚本！"
        found=1
    fi
    
    # 检查定时任务
    if crontab -l 2>/dev/null | grep -q "\.update"; then
        log "⚠️  检测到定时任务中有可疑脚本！"
        found=1
    fi
    
    if [ $found -eq 1 ]; then
        log "❌ 发现安全问题，请立即检查！"
        return 1
    fi
    
    return 0
}

# 检查SSH登录
check_ssh() {
    local failed=$(grep "Failed password" /var/log/auth.log 2>/dev/null | tail -10 | wc -l)
    if [ "$failed" -gt 5 ]; then
        log "⚠️  检测到多次SSH登录失败: $failed 次"
    fi
}

check_malicious
check_ssh
EOF

chmod +x "$SECURITY_SCRIPT"
echo "✅ 安全检查脚本已创建: $SECURITY_SCRIPT"

# 6. 添加安全定时检查（每天检查一次）
SECURITY_CRON="0 2 * * * $SECURITY_SCRIPT"
if crontab -l 2>/dev/null | grep -q "security-check.sh"; then
    echo "⚠️  安全检查任务已存在，跳过添加"
else
    (crontab -l 2>/dev/null; echo "$SECURITY_CRON") | crontab -
    echo "✅ 已添加安全定时检查（每天凌晨2点）"
fi

# 7. 显示当前定时任务
echo ""
echo "=========================================="
echo "当前定时任务："
echo "=========================================="
crontab -l

echo ""
echo "=========================================="
echo "设置完成！"
echo "=========================================="
echo ""
echo "监控日志位置："
echo "  - 应用监控: /var/log/podroom-monitor.log"
echo "  - 安全检查: /var/log/podroom-security.log"
echo ""
echo "手动执行监控："
echo "  $MONITOR_SCRIPT"
echo ""

