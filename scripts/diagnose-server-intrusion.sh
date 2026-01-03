#!/bin/bash

# 服务器入侵诊断脚本

echo "=========================================="
echo "服务器入侵诊断脚本"
echo "=========================================="
echo ""

LOG_FILE="/var/log/server-intrusion-diagnosis.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 1. 检查CPU占用最高的进程
echo "=== 1. CPU占用最高的进程（Top 10）==="
ps aux --sort=-%cpu | head -11
echo ""

# 2. 检查内存占用最高的进程
echo "=== 2. 内存占用最高的进程（Top 10）==="
ps aux --sort=-%mem | head -11
echo ""

# 3. 检查可疑进程
echo "=== 3. 可疑进程检查 ==="
echo "检查包含 .update, .sh, wget, curl 的进程："
ps aux | grep -E "\.update|\.sh|wget|curl|miner|mine" | grep -v grep
echo ""

# 4. 检查网络连接
echo "=== 4. 异常网络连接 ==="
echo "检查ESTABLISHED连接："
netstat -tulnp | grep ESTABLISHED | head -20
echo ""

echo "检查监听端口："
netstat -tulnp | grep LISTEN
echo ""

# 5. 检查定时任务
echo "=== 5. 定时任务检查 ==="
echo "用户定时任务："
crontab -l 2>/dev/null || echo "无定时任务"
echo ""

echo "系统定时任务："
cat /etc/crontab | grep -v "^#"
echo ""

echo "定时任务目录："
ls -la /etc/cron.d/ 2>/dev/null
ls -la /etc/cron.hourly/ 2>/dev/null
ls -la /etc/cron.daily/ 2>/dev/null
echo ""

# 6. 检查系统服务
echo "=== 6. 可疑系统服务 ==="
systemctl list-units --type=service --all | grep -E "update|\.sh|miner" | head -10
echo ""

# 7. 检查配置文件中的恶意脚本
echo "=== 7. 配置文件恶意脚本检查 ==="
echo "检查 /etc/profile："
grep -n "\.update\|while true.*startup" /etc/profile 2>/dev/null || echo "未发现"
echo ""

echo "检查 /root/.bashrc："
grep -n "\.update\|while true.*startup" /root/.bashrc 2>/dev/null || echo "未发现"
echo ""

# 8. 检查可疑文件
echo "=== 8. 可疑文件检查 ==="
echo "检查 /usr/bin 中的隐藏文件："
find /usr/bin -name ".*" -type f 2>/dev/null
echo ""

echo "检查 /tmp 中的可疑文件："
find /tmp -name ".*" -type f -mtime -7 2>/dev/null | head -10
echo ""

# 9. 检查系统资源
echo "=== 9. 系统资源使用情况 ==="
echo "内存使用："
free -h
echo ""

echo "磁盘使用："
df -h
echo ""

echo "CPU负载："
uptime
echo ""

# 10. 检查系统日志
echo "=== 10. 系统日志检查 ==="
echo "最近的SSH登录："
tail -20 /var/log/auth.log | grep -E "Failed|Accepted" | tail -10
echo ""

echo "系统错误日志："
dmesg | tail -20
echo ""

# 11. 检查挖矿相关
echo "=== 11. 挖矿程序检查 ==="
echo "检查常见挖矿程序："
ps aux | grep -iE "xmrig|minerd|cpuminer|stratum|mining" | grep -v grep
echo ""

echo "检查可疑的CPU密集型进程："
ps aux | awk '$3 > 50 {print $0}' | head -10
echo ""

log "诊断完成"

