#!/bin/bash

# CPU飙升诊断脚本
# 用于快速定位CPU占用高的进程和原因

echo "=========================================="
echo "CPU飙升诊断脚本"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# 1. 查看CPU占用最高的10个进程
echo "【1】CPU占用最高的10个进程："
echo "----------------------------------------"
ps aux --sort=-%cpu | head -11
echo ""

# 2. 检查可疑进程（恶意脚本特征）
echo "【2】检查可疑进程（.update, .sh, miner, xmrig等）："
echo "----------------------------------------"
SUSPICIOUS=$(ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323|nc.*sh" | grep -v grep)
if [ -z "$SUSPICIOUS" ]; then
    echo "✅ 未发现明显的可疑进程"
else
    echo "⚠️ 发现可疑进程："
    echo "$SUSPICIOUS"
fi
echo ""

# 3. 检查系统负载
echo "【3】系统负载和CPU核心数："
echo "----------------------------------------"
echo "CPU核心数: $(nproc)"
echo "1分钟负载: $(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}')"
echo "5分钟负载: $(uptime | awk -F'load average:' '{print $2}' | awk '{print $2}')"
echo "15分钟负载: $(uptime | awk -F'load average:' '{print $2}' | awk '{print $3}')"
echo ""

# 4. 检查top进程的详细信息
echo "【4】CPU占用最高的进程详细信息（前3个）："
echo "----------------------------------------"
TOP_PIDS=$(ps aux --sort=-%cpu | head -4 | tail -3 | awk '{print $2}')
for PID in $TOP_PIDS; do
    if [ "$PID" != "PID" ]; then
        echo "--- PID: $PID ---"
        ps -p $PID -o pid,ppid,user,cmd,%cpu,%mem,etime,start
        echo "进程树："
        pstree -p $PID 2>/dev/null || echo "无法显示进程树"
        echo ""
    fi
done

# 5. 检查网络连接（可能的后门）
echo "【5】检查异常网络连接（ESTABLISHED状态）："
echo "----------------------------------------"
netstat -tulnp 2>/dev/null | grep ESTABLISHED | head -10
echo ""

# 6. 检查定时任务
echo "【6】检查当前用户的定时任务："
echo "----------------------------------------"
crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" || echo "无定时任务"
echo ""

# 7. 检查系统定时任务
echo "【7】检查系统定时任务（/etc/cron.*）："
echo "----------------------------------------"
for cron_dir in /etc/cron.hourly /etc/cron.daily /etc/cron.weekly /etc/cron.monthly /etc/cron.d; do
    if [ -d "$cron_dir" ]; then
        echo "--- $cron_dir ---"
        ls -la "$cron_dir" 2>/dev/null | grep -v "^d" | grep -v "^total"
    fi
done
echo ""

# 8. 检查最近修改的可执行文件
echo "【8】检查最近1小时内修改的可执行文件（/usr/bin, /tmp, /opt）："
echo "----------------------------------------"
find /usr/bin /tmp /opt -type f -perm +111 -mmin -60 2>/dev/null | head -10
echo ""

# 9. 检查内存使用情况
echo "【9】内存使用情况："
echo "----------------------------------------"
free -h
echo ""

# 10. 检查磁盘IO
echo "【10】磁盘IO情况（top 5）："
echo "----------------------------------------"
iostat -x 1 2 2>/dev/null | tail -6 || echo "iostat未安装，跳过"
echo ""

# 11. 检查应用进程（PM2）
echo "【11】PM2进程状态："
echo "----------------------------------------"
if command -v pm2 &> /dev/null; then
    pm2 list
    echo ""
    echo "PM2进程CPU使用："
    pm2 jlist | jq -r '.[] | "\(.name): CPU=\(.monit.cpu)%, MEM=\(.monit.memory/1024/1024)MB"' 2>/dev/null || pm2 list
else
    echo "PM2未安装"
fi
echo ""

# 12. 检查Nginx进程
echo "【12】Nginx进程："
echo "----------------------------------------"
ps aux | grep nginx | grep -v grep || echo "Nginx未运行"
echo ""

# 13. 检查系统日志中的异常（最近10分钟）
echo "【13】系统日志异常（最近10分钟，最多20条）："
echo "----------------------------------------"
journalctl --since "10 minutes ago" --priority=err --no-pager 2>/dev/null | tail -20 || echo "无法读取系统日志"
echo ""

echo "=========================================="
echo "诊断完成"
echo "=========================================="
echo ""
echo "【建议操作】"
echo "1. 如果发现可疑进程，记录PID后执行: kill -9 <PID>"
echo "2. 如果某个进程持续占用CPU，检查其日志文件"
echo "3. 如果是应用进程，检查应用日志: pm2 logs"
echo "4. 如果怀疑是恶意脚本，检查: /usr/bin/.update, /tmp/*.sh"
echo "5. 检查系统资源是否充足: free -h, df -h"

