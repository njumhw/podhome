#!/bin/bash

# CPU监控和自动处理脚本
# 设置定期监控CPU使用率，并在异常时自动处理

echo "=========================================="
echo "CPU监控和自动处理设置"
echo "=========================================="
echo ""

# 1. 创建监控脚本
MONITOR_SCRIPT="/opt/podroom/scripts/monitor-cpu.sh"
cat > "$MONITOR_SCRIPT" << 'EOF'
#!/bin/bash

# CPU监控脚本
# 每5分钟检查一次CPU使用率，如果持续100%超过10分钟，执行诊断

LOG_FILE="/opt/podroom/logs/cpu-monitor.log"
ALERT_THRESHOLD=95  # CPU使用率阈值（%）
DURATION_THRESHOLD=10  # 持续时间阈值（分钟）

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

# 获取当前CPU使用率（1分钟平均值）
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')

# 记录日志
echo "[$(date '+%Y-%m-%d %H:%M:%S')] CPU使用率: ${CPU_USAGE}%" >> "$LOG_FILE"

# 检查是否超过阈值
if (( $(echo "$CPU_USAGE > $ALERT_THRESHOLD" | bc -l) )); then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ CPU使用率超过阈值: ${CPU_USAGE}%" >> "$LOG_FILE"
    
    # 获取CPU占用最高的进程
    TOP_PROCESS=$(ps aux --sort=-%cpu | head -2 | tail -1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 最高CPU进程: $TOP_PROCESS" >> "$LOG_FILE"
    
    # 检查是否是可疑进程
    SUSPICIOUS=$(ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep)
    if [ -n "$SUSPICIOUS" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 发现可疑进程！" >> "$LOG_FILE"
        echo "$SUSPICIOUS" >> "$LOG_FILE"
        
        # 自动清理可疑进程
        echo "$SUSPICIOUS" | awk '{print $2}' | xargs -r kill -9 2>/dev/null
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 已自动清理可疑进程" >> "$LOG_FILE"
        
        # 发送通知（如果有配置）
        # 可以在这里添加邮件、Slack等通知
    fi
    
    # 如果持续高CPU，执行完整诊断
    HIGH_CPU_COUNT=$(grep "CPU使用率超过阈值" "$LOG_FILE" | tail -10 | wc -l)
    if [ "$HIGH_CPU_COUNT" -ge 2 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 执行CPU诊断..." >> "$LOG_FILE"
        /opt/podroom/scripts/diagnose-cpu-spike.sh >> "$LOG_FILE" 2>&1
    fi
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ CPU使用率正常: ${CPU_USAGE}%" >> "$LOG_FILE"
fi

# 清理旧日志（保留最近7天）
find "$(dirname "$LOG_FILE")" -name "*.log" -mtime +7 -delete 2>/dev/null
EOF

chmod +x "$MONITOR_SCRIPT"
echo "✅ 监控脚本已创建: $MONITOR_SCRIPT"

# 2. 添加到crontab（每5分钟执行一次）
CRON_JOB="*/5 * * * * $MONITOR_SCRIPT"
(crontab -l 2>/dev/null | grep -v "$MONITOR_SCRIPT"; echo "$CRON_JOB") | crontab -
echo "✅ 已添加到crontab（每5分钟执行一次）"

# 3. 创建CPU使用率历史记录脚本（每小时记录一次）
HISTORY_SCRIPT="/opt/podroom/scripts/record-cpu-history.sh"
cat > "$HISTORY_SCRIPT" << 'EOF'
#!/bin/bash

# CPU使用率历史记录脚本
HISTORY_FILE="/opt/podroom/logs/cpu-history.csv"

# 创建CSV文件头（如果不存在）
if [ ! -f "$HISTORY_FILE" ]; then
    echo "timestamp,cpu_usage,top_process,top_process_cpu" > "$HISTORY_FILE"
fi

# 获取CPU使用率
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')

# 获取CPU占用最高的进程
TOP_PROCESS=$(ps aux --sort=-%cpu | head -2 | tail -1)
TOP_PROCESS_NAME=$(echo "$TOP_PROCESS" | awk '{print $11}')
TOP_PROCESS_CPU=$(echo "$TOP_PROCESS" | awk '{print $3}')

# 记录到CSV
echo "$(date '+%Y-%m-%d %H:%M:%S'),${CPU_USAGE},${TOP_PROCESS_NAME},${TOP_PROCESS_CPU}" >> "$HISTORY_FILE"
EOF

chmod +x "$HISTORY_SCRIPT"
echo "✅ 历史记录脚本已创建: $HISTORY_SCRIPT"

# 添加到crontab（每小时执行一次）
CRON_HISTORY="0 * * * * $HISTORY_SCRIPT"
(crontab -l 2>/dev/null | grep -v "$HISTORY_SCRIPT"; echo "$CRON_HISTORY") | crontab -
echo "✅ 已添加到crontab（每小时记录一次）"

# 4. 创建自动清理脚本（每天执行一次）
CLEANUP_SCRIPT="/opt/podroom/scripts/auto-cleanup.sh"
cat > "$CLEANUP_SCRIPT" << 'EOF'
#!/bin/bash

# 自动清理脚本
# 每天执行一次，清理可疑文件和进程

LOG_FILE="/opt/podroom/logs/auto-cleanup.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始自动清理..." >> "$LOG_FILE"

# 1. 清理可疑进程
SUSPICIOUS_PROCESSES=$(ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep)
if [ -n "$SUSPICIOUS_PROCESSES" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 发现可疑进程，正在清理..." >> "$LOG_FILE"
    echo "$SUSPICIOUS_PROCESSES" | awk '{print $2}' | xargs -r kill -9 2>/dev/null
    echo "$SUSPICIOUS_PROCESSES" >> "$LOG_FILE"
fi

# 2. 清理可疑文件
SUSPICIOUS_FILES=(
    "/usr/bin/.update"
    "/tmp/x.sh"
    "/tmp/f"
    "/tmp/*.sh"
)

for file in "${SUSPICIOUS_FILES[@]}"; do
    if [ -e $file ] 2>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 删除可疑文件: $file" >> "$LOG_FILE"
        rm -f $file 2>/dev/null
    fi
done

# 3. 清理临时文件（超过7天）
find /tmp -type f -mtime +7 -delete 2>/dev/null
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 清理完成" >> "$LOG_FILE"
EOF

chmod +x "$CLEANUP_SCRIPT"
echo "✅ 自动清理脚本已创建: $CLEANUP_SCRIPT"

# 添加到crontab（每天凌晨3点执行）
CRON_CLEANUP="0 3 * * * $CLEANUP_SCRIPT"
(crontab -l 2>/dev/null | grep -v "$CLEANUP_SCRIPT"; echo "$CRON_CLEANUP") | crontab -
echo "✅ 已添加到crontab（每天凌晨3点执行）"

# 5. 显示当前crontab
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
echo "【监控说明】"
echo "1. CPU监控：每5分钟检查一次，超过95%会记录日志"
echo "2. 历史记录：每小时记录一次CPU使用率到CSV文件"
echo "3. 自动清理：每天凌晨3点自动清理可疑进程和文件"
echo ""
echo "【查看日志】"
echo "- 监控日志: tail -f /opt/podroom/logs/cpu-monitor.log"
echo "- 历史记录: cat /opt/podroom/logs/cpu-history.csv"
echo "- 清理日志: tail -f /opt/podroom/logs/auto-cleanup.log"
echo ""
echo "【手动诊断】"
echo "如果CPU再次飙升，执行: /opt/podroom/scripts/diagnose-cpu-spike.sh"

