# 立即CPU诊断命令

## 第一步：立即清理恶意脚本残留

```bash
# 1. 检查并清理配置文件中的恶意代码
grep -n "\.update" /etc/profile /root/.bashrc

# 2. 删除所有.update相关的内容
sed -i '/\.update/d' /etc/profile /root/.bashrc
sed -i '/while true/,/done &/d' /etc/profile /root/.bashrc

# 3. 删除可疑文件
rm -f /usr/bin/.update /usr/bin/.update.update
rm -f /tmp/x.sh /tmp/f /tmp/*.sh

# 4. 清理定时任务
crontab -l | grep -vE "weball|12323|\.update" | crontab -

# 5. 终止可疑进程
ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null
```

## 第二步：立即诊断CPU问题

```bash
# 1. 查看CPU占用最高的10个进程
echo "=== CPU占用最高的10个进程 ==="
ps aux --sort=-%cpu | head -11

# 2. 检查可疑进程
echo ""
echo "=== 检查可疑进程 ==="
ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323|nc.*sh" | grep -v grep || echo "未发现可疑进程"

# 3. 检查系统负载
echo ""
echo "=== 系统负载 ==="
uptime
echo "CPU核心数: $(nproc)"

# 4. 检查网络连接
echo ""
echo "=== 异常网络连接（前10个） ==="
netstat -tulnp 2>/dev/null | grep ESTABLISHED | head -10

# 5. 检查PM2进程
echo ""
echo "=== PM2进程状态 ==="
pm2 list 2>/dev/null || echo "PM2未运行"

# 6. 检查Nginx进程
echo ""
echo "=== Nginx进程 ==="
ps aux | grep nginx | grep -v grep || echo "Nginx未运行"

# 7. 检查定时任务
echo ""
echo "=== 当前用户的定时任务 ==="
crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" || echo "无定时任务"

# 8. 检查系统定时任务
echo ""
echo "=== 系统定时任务 ==="
ls -la /etc/cron.hourly /etc/cron.daily /etc/cron.weekly /etc/cron.monthly /etc/cron.d 2>/dev/null | grep -v "^d" | grep -v "^total" | head -20
```

## 第三步：创建诊断脚本（如果pull失败）

如果无法从GitHub pull脚本，可以手动创建：

```bash
cd /opt/podroom

# 创建诊断脚本
cat > scripts/diagnose-cpu-spike.sh << 'SCRIPT_EOF'
#!/bin/bash
echo "=========================================="
echo "CPU飙升诊断脚本"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

echo "【1】CPU占用最高的10个进程："
ps aux --sort=-%cpu | head -11
echo ""

echo "【2】检查可疑进程："
SUSPICIOUS=$(ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep)
if [ -z "$SUSPICIOUS" ]; then
    echo "✅ 未发现可疑进程"
else
    echo "⚠️ 发现可疑进程："
    echo "$SUSPICIOUS"
fi
echo ""

echo "【3】系统负载："
uptime
echo "CPU核心数: $(nproc)"
echo ""

echo "【4】网络连接（前10个）："
netstat -tulnp 2>/dev/null | grep ESTABLISHED | head -10
echo ""

echo "【5】PM2进程："
pm2 list 2>/dev/null || echo "PM2未运行"
echo ""

echo "【6】定时任务："
crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" || echo "无定时任务"
echo ""

echo "【7】内存使用："
free -h
echo ""

echo "【8】磁盘使用："
df -h | head -5
echo ""

echo "=========================================="
echo "诊断完成"
echo "=========================================="
SCRIPT_EOF

chmod +x scripts/diagnose-cpu-spike.sh
./scripts/diagnose-cpu-spike.sh
```

## 第四步：根据诊断结果处理

### 如果发现可疑进程

```bash
# 记录PID并终止
ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep

# 终止进程（替换<PID>为实际PID）
kill -9 <PID>

# 或者批量终止
ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null
```

### 如果是应用进程占用高

```bash
# 查看PM2日志
pm2 logs --lines 100

# 查看Nginx访问日志
tail -50 /var/log/nginx/access.log

# 如果必要，重启应用
pm2 restart all
```

## 第五步：设置监控（手动创建）

```bash
cd /opt/podroom

# 创建监控脚本
cat > scripts/monitor-cpu.sh << 'MONITOR_EOF'
#!/bin/bash
LOG_FILE="/opt/podroom/logs/cpu-monitor.log"
mkdir -p "$(dirname "$LOG_FILE")"

CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] CPU使用率: ${CPU_USAGE}%" >> "$LOG_FILE"

if (( $(echo "$CPU_USAGE > 95" | bc -l) )); then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ CPU使用率超过95%: ${CPU_USAGE}%" >> "$LOG_FILE"
    TOP_PROCESS=$(ps aux --sort=-%cpu | head -2 | tail -1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 最高CPU进程: $TOP_PROCESS" >> "$LOG_FILE"
    
    # 检查可疑进程
    SUSPICIOUS=$(ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep)
    if [ -n "$SUSPICIOUS" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚨 发现可疑进程！" >> "$LOG_FILE"
        echo "$SUSPICIOUS" >> "$LOG_FILE"
        echo "$SUSPICIOUS" | awk '{print $2}' | xargs -r kill -9 2>/dev/null
    fi
fi
MONITOR_EOF

chmod +x scripts/monitor-cpu.sh

# 添加到crontab（每5分钟执行一次）
(crontab -l 2>/dev/null | grep -v "monitor-cpu.sh"; echo "*/5 * * * * /opt/podroom/scripts/monitor-cpu.sh") | crontab -

echo "✅ 监控已设置"
```

