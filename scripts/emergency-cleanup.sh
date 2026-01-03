#!/bin/bash

# 紧急清理恶意进程和后门

echo "=========================================="
echo "紧急清理恶意进程和后门"
echo "=========================================="
echo ""

# 1. 终止恶意进程
echo "=== 1. 终止恶意进程 ==="
MALICIOUS_PIDS=$(ps aux | grep -E "wget.*weball|nc.*12323|/tmp/x.sh" | grep -v grep | awk '{print $2}')

if [ -n "$MALICIOUS_PIDS" ]; then
    echo "发现恶意进程，PID: $MALICIOUS_PIDS"
    for pid in $MALICIOUS_PIDS; do
        echo "终止进程 $pid"
        kill -9 $pid 2>/dev/null
    done
    sleep 2
    echo "✅ 恶意进程已终止"
else
    echo "✅ 未发现恶意进程"
fi
echo ""

# 2. 删除恶意文件
echo "=== 2. 删除恶意文件 ==="
MALICIOUS_FILES=(
    "/tmp/x.sh"
    "/tmp/f"
    "/usr/bin/.update"
)

for file in "${MALICIOUS_FILES[@]}"; do
    if [ -f "$file" ] || [ -p "$file" ]; then
        echo "删除: $file"
        rm -f "$file"
    fi
done
echo "✅ 恶意文件已删除"
echo ""

# 3. 修复配置文件
echo "=== 3. 修复配置文件 ==="
# 备份
cp /etc/profile /etc/profile.backup.$(date +%Y%m%d_%H%M%S)
cp /root/.bashrc /root/.bashrc.backup.$(date +%Y%m%d_%H%M%S)

# 清理
sed -i '/\.update/d' /etc/profile
sed -i '/\.update/d' /root/.bashrc
sed -i '/while true/,/done &/d' /etc/profile
sed -i '/while true/,/done &/d' /root/.bashrc

# 验证
if ! grep -q "\.update" /etc/profile 2>/dev/null && ! grep -q "\.update" /root/.bashrc 2>/dev/null; then
    echo "✅ 配置文件已清理"
else
    echo "❌ 配置文件仍有残留"
fi
echo ""

# 4. 检查定时任务
echo "=== 4. 检查定时任务 ==="
if crontab -l 2>/dev/null | grep -qE "weball|12323|\.update"; then
    echo "⚠️  发现可疑定时任务"
    crontab -l > /root/crontab.backup.$(date +%Y%m%d_%H%M%S)
    crontab -l | grep -vE "weball|12323|\.update" | crontab -
    echo "✅ 已清理定时任务"
else
    echo "✅ 定时任务正常"
fi
echo ""

# 5. 检查系统服务
echo "=== 5. 检查系统服务 ==="
systemctl list-units --type=service --all | grep -E "weball|\.update" || echo "✅ 未发现可疑服务"
echo ""

# 6. 检查网络连接
echo "=== 6. 检查异常网络连接 ==="
echo "检查连接到可疑IP的连接："
netstat -tulnp | grep -E "94.154.35.154|193.142.147.209" || echo "✅ 未发现可疑连接"
echo ""

# 7. 检查其他可疑文件
echo "=== 7. 检查其他可疑文件 ==="
find /tmp -name "*.sh" -mtime -1 2>/dev/null | head -10
find /tmp -name "f" -type p 2>/dev/null
echo ""

echo "=========================================="
echo "紧急清理完成"
echo "=========================================="
echo ""
echo "⚠️  重要：请立即更改所有密码并检查SSH密钥！"

