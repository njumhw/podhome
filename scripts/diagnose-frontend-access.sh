#!/bin/bash

echo "=========================================="
echo "前端访问问题诊断脚本"
echo "=========================================="
echo ""

echo "=== 1. PM2应用状态 ==="
pm2 list
echo ""

echo "=== 2. 端口监听状态 ==="
echo "检查3005端口："
netstat -tlnp | grep :3005 || echo "3005端口未监听"
echo ""

echo "=== 3. 应用进程详情 ==="
pm2 describe podroom
echo ""

echo "=== 4. 应用日志（最后30行）==="
pm2 logs podroom --lines 30 --nostream
echo ""

echo "=== 5. 应用错误日志（最后30行）==="
pm2 logs podroom --err --lines 30 --nostream
echo ""

echo "=== 6. 本地访问测试 ==="
echo "测试 http://localhost:3005："
curl -I http://localhost:3005 2>&1 | head -10 || echo "本地访问失败"
echo ""

echo "测试 http://localhost:3005/home："
curl -I http://localhost:3005/home 2>&1 | head -10 || echo "本地访问失败"
echo ""

echo "=== 7. Nginx状态 ==="
systemctl status nginx --no-pager | head -15
echo ""

echo "=== 8. Nginx错误日志（最后20行）==="
tail -20 /var/log/nginx/error.log 2>/dev/null || echo "无法读取Nginx错误日志"
echo ""

echo "=== 9. Nginx配置检查 ==="
echo "检查proxy_pass配置："
grep -A 2 "proxy_pass" /etc/nginx/sites-available/podroom 2>/dev/null || echo "无法读取Nginx配置"
echo ""

echo "=== 10. HTTPS访问测试 ==="
echo "测试 https://podcasttoinsight.top："
curl -I https://podcasttoinsight.top 2>&1 | head -10 || echo "HTTPS访问失败"
echo ""

echo "=== 11. 应用环境变量 ==="
pm2 env 0 | grep -E "PORT|NODE_ENV|DATABASE_URL" | head -5
echo ""

echo "=== 12. 检查.next目录 ==="
if [ -d ".next" ]; then
    echo ".next目录存在"
    ls -la .next | head -5
else
    echo ".next目录不存在！应用可能未构建"
fi
echo ""

echo "=========================================="
echo "诊断完成"
echo "=========================================="

