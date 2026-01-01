#!/bin/bash

# 应用监控脚本
# 功能：自动检测应用和Nginx状态，异常时自动恢复并发送通知

LOG_FILE="/var/log/podroom-monitor.log"
MAX_LOG_SIZE=10485760  # 10MB

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查日志大小，如果太大则轮转
if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt $MAX_LOG_SIZE ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
    touch "$LOG_FILE"
fi

# 检查PM2应用状态
check_pm2() {
    local status=$(pm2 jlist | jq -r '.[0].pm2_env.status' 2>/dev/null)
    if [ "$status" != "online" ]; then
        log "❌ PM2应用状态异常: $status，尝试重启..."
        pm2 restart podroom
        sleep 5
        local new_status=$(pm2 jlist | jq -r '.[0].pm2_env.status' 2>/dev/null)
        if [ "$new_status" = "online" ]; then
            log "✅ PM2应用重启成功"
        else
            log "❌ PM2应用重启失败，状态: $new_status"
        fi
    fi
}

# 检查应用端口监听
check_port() {
    if ! netstat -tlnp 2>/dev/null | grep -q ":3005.*LISTEN"; then
        log "❌ 端口3005未监听，尝试重启应用..."
        pm2 restart podroom
        sleep 5
        if netstat -tlnp 2>/dev/null | grep -q ":3005.*LISTEN"; then
            log "✅ 端口3005恢复监听"
        else
            log "❌ 端口3005仍未监听"
        fi
    fi
}

# 检查Nginx状态
check_nginx() {
    if ! systemctl is-active --quiet nginx; then
        log "❌ Nginx服务未运行，尝试启动..."
        systemctl start nginx
        sleep 2
        if systemctl is-active --quiet nginx; then
            log "✅ Nginx服务启动成功"
        else
            log "❌ Nginx服务启动失败"
            systemctl status nginx --no-pager | head -10 >> "$LOG_FILE"
        fi
    fi
}

# 检查Nginx端口监听
check_nginx_port() {
    if ! netstat -tlnp 2>/dev/null | grep -qE ":(80|443).*LISTEN"; then
        log "❌ Nginx端口未监听，尝试重启..."
        systemctl restart nginx
        sleep 2
        if netstat -tlnp 2>/dev/null | grep -qE ":(80|443).*LISTEN"; then
            log "✅ Nginx端口恢复监听"
        else
            log "❌ Nginx端口仍未监听"
        fi
    fi
}

# 检查本地访问
check_local_access() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3005/home 2>/dev/null)
    if [ "$response" != "200" ] && [ "$response" != "307" ]; then
        log "❌ 本地访问异常，HTTP状态码: $response"
        return 1
    fi
    return 0
}

# 检查HTTPS访问
check_https_access() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://podcasttoinsight.top/home 2>/dev/null)
    if [ "$response" != "200" ] && [ "$response" != "307" ]; then
        log "❌ HTTPS访问异常，HTTP状态码: $response"
        return 1
    fi
    return 0
}

# 检查恶意脚本
check_malicious_scripts() {
    # 检查 /etc/profile
    if grep -q "\.update\|while true.*startup" /etc/profile 2>/dev/null; then
        log "⚠️  检测到 /etc/profile 中有可疑脚本！"
        return 1
    fi
    
    # 检查 .bashrc
    if [ -f /root/.bashrc ] && grep -q "\.update\|while true.*startup" /root/.bashrc 2>/dev/null; then
        log "⚠️  检测到 /root/.bashrc 中有可疑脚本！"
        return 1
    fi
    
    return 0
}

# 检查系统资源
check_resources() {
    local mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    if [ "$mem_usage" -gt 90 ]; then
        log "⚠️  内存使用率过高: ${mem_usage}%"
    fi
    
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        log "⚠️  磁盘使用率过高: ${disk_usage}%"
    fi
}

# 主函数
main() {
    log "开始监控检查..."
    
    check_pm2
    check_port
    check_nginx
    check_nginx_port
    check_local_access
    check_https_access
    check_malicious_scripts
    check_resources
    
    log "监控检查完成"
}

main

