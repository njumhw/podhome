#!/bin/bash

echo "=========================================="
echo "安全状态验证"
echo "=========================================="
echo ""

echo "=== 1. 应用状态 ==="
pm2 list | grep podroom
echo ""

echo "=== 2. Nginx状态 ==="
systemctl is-active nginx && echo "✅ Nginx运行中" || echo "❌ Nginx未运行"
echo ""

echo "=== 3. Fail2ban状态 ==="
systemctl is-active fail2ban && echo "✅ Fail2ban运行中" || echo "❌ Fail2ban未运行"
fail2ban-client status sshd 2>/dev/null | head -5 || echo "⚠️  Fail2ban配置中..."
echo ""

echo "=== 4. 恶意进程检查 ==="
ps aux | grep -E "weball|12323|\.update" | grep -v grep || echo "✅ 无恶意进程"
echo ""

echo "=== 5. 配置文件检查 ==="
grep -n "\.update" /etc/profile /root/.bashrc 2>/dev/null || echo "✅ 配置文件干净"
echo ""

echo "=== 6. 定时任务检查 ==="
crontab -l | grep -v "^#" | head -5
echo ""

echo "=== 7. 网络连接检查 ==="
netstat -tulnp | grep ESTABLISHED | grep -E "94.154.35.154|193.142.147.209" || echo "✅ 无可疑连接"
echo ""

echo "=== 8. CPU和内存使用 ==="
top -bn1 | head -5
echo ""

echo "=========================================="
echo "验证完成"
echo "=========================================="
