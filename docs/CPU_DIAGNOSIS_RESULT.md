# CPU诊断结果分析和后续处理

## 当前状态

✅ **好消息**：
- 当前CPU使用正常（系统负载0.13）
- 未发现可疑进程
- PM2和Nginx正常运行
- 应用进程（next-server）CPU使用率5.6%，正常

⚠️ **需要注意**：
- `.update: applet not found` 错误仍然出现，说明配置文件可能还有残留

## 进一步检查

### 1. 检查配置文件是否完全清理

```bash
# 检查 /etc/profile
grep -n "\.update\|while true" /etc/profile

# 检查 /root/.bashrc
grep -n "\.update\|while true" /root/.bashrc

# 检查 /etc/bash.bashrc（如果存在）
grep -n "\.update\|while true" /etc/bash.bashrc 2>/dev/null

# 检查所有bash配置文件
find /etc -name "*.sh" -o -name "profile*" -o -name "bashrc*" 2>/dev/null | xargs grep -l "\.update" 2>/dev/null
```

### 2. 查看应用日志（检查是否有异常请求或任务）

```bash
# 查看PM2日志（最近100行）
pm2 logs --lines 100 --nostream

# 查看Nginx访问日志（最近50行，按时间倒序）
tail -50 /var/log/nginx/access.log | sort -r

# 查看Nginx错误日志
tail -50 /var/log/nginx/error.log

# 查看系统日志（最近1小时）
journalctl --since "1 hour ago" | tail -50
```

### 3. 检查是否有定时任务导致CPU飙升

```bash
# 查看所有定时任务
crontab -l

# 检查系统定时任务目录
ls -la /etc/cron.hourly /etc/cron.daily /etc/cron.weekly /etc/cron.monthly /etc/cron.d

# 检查是否有异常脚本
find /etc/cron* -type f -exec grep -l "\.update\|weball\|12323" {} \; 2>/dev/null
```

### 4. 检查CPU历史记录（如果之前设置了监控）

```bash
# 查看监控日志
tail -100 /opt/podroom/logs/cpu-monitor.log 2>/dev/null || echo "监控日志不存在"

# 查看CPU历史记录
cat /opt/podroom/logs/cpu-history.csv 2>/dev/null || echo "历史记录不存在"
```

## 可能的原因分析

### 原因1：恶意脚本残留（最可能）

`.update: applet not found` 说明：
- 配置文件（/etc/profile 或 /root/.bashrc）中可能还有残留代码
- 每次打开新shell时都会尝试执行 `.update` 命令
- 虽然文件已删除，但配置文件中还在调用

**处理**：彻底清理配置文件

### 原因2：应用处理任务时CPU飙升

从CPU图表看：
- 13:00左右CPU飙到100%
- 可能是应用在处理大量请求或后台任务

**处理**：查看应用日志，检查是否有大量请求或长时间运行的任务

### 原因3：定时任务执行

**处理**：检查定时任务，看是否有耗时任务

## 立即执行的完整清理和检查

```bash
# ========== 第一步：彻底清理配置文件 ==========
echo "=== 检查配置文件 ==="
echo "--- /etc/profile ---"
grep -n "\.update\|while true" /etc/profile || echo "未发现恶意代码"

echo ""
echo "--- /root/.bashrc ---"
grep -n "\.update\|while true" /root/.bashrc || echo "未发现恶意代码"

echo ""
echo "--- /etc/bash.bashrc ---"
grep -n "\.update\|while true" /etc/bash.bashrc 2>/dev/null || echo "未发现恶意代码"

# 如果发现恶意代码，执行清理
# sed -i '/\.update/d' /etc/profile /root/.bashrc /etc/bash.bashrc
# sed -i '/while true/,/done &/d' /etc/profile /root/.bashrc /etc/bash.bashrc

# ========== 第二步：检查应用日志 ==========
echo ""
echo "=== PM2日志（最近50行） ==="
pm2 logs --lines 50 --nostream | tail -50

echo ""
echo "=== Nginx访问日志（最近20行） ==="
tail -20 /var/log/nginx/access.log

# ========== 第三步：检查定时任务 ==========
echo ""
echo "=== 所有定时任务 ==="
crontab -l

echo ""
echo "=== 系统定时任务目录 ==="
ls -la /etc/cron.d/ 2>/dev/null | head -10

# ========== 第四步：检查系统资源 ==========
echo ""
echo "=== 内存使用 ==="
free -h

echo ""
echo "=== 磁盘使用 ==="
df -h | head -5
```

## 设置持续监控

执行以下命令设置监控：

```bash
cd /opt/podroom

# 创建监控脚本
cat > scripts/monitor-cpu.sh << 'EOF'
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
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 已自动清理可疑进程" >> "$LOG_FILE"
    fi
    
    # 执行诊断
    /opt/podroom/scripts/diagnose-cpu-spike.sh >> "$LOG_FILE" 2>&1
fi
EOF

chmod +x scripts/monitor-cpu.sh

# 添加到crontab（每5分钟执行一次）
(crontab -l 2>/dev/null | grep -v "monitor-cpu.sh"; echo "*/5 * * * * /opt/podroom/scripts/monitor-cpu.sh") | crontab -

echo "✅ CPU监控已设置（每5分钟检查一次）"
echo "查看日志: tail -f /opt/podroom/logs/cpu-monitor.log"
```

## 预防措施

1. **定期检查配置文件**
   ```bash
   # 每天检查一次
   0 2 * * * grep -l "\.update" /etc/profile /root/.bashrc /etc/bash.bashrc 2>/dev/null && echo "发现恶意代码残留" | mail -s "安全警报" admin@example.com
   ```

2. **监控CPU使用率**
   - 已设置每5分钟检查一次
   - 超过95%时自动记录日志

3. **定期安全检查**
   ```bash
   # 每天执行一次安全检查
   0 3 * * * /opt/podroom/scripts/verify-security-status.sh
   ```

4. **加强SSH安全**
   - 安装Fail2ban
   - 更改SSH端口（可选）
   - 禁用root密码登录（使用密钥）

