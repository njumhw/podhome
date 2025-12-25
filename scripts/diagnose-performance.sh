#!/bin/bash
# 性能问题诊断脚本

echo "=========================================="
echo "性能问题诊断脚本"
echo "=========================================="
echo ""

cd /opt/podroom || exit 1

echo "=== 1. 服务器资源使用情况 ==="
echo "CPU和内存："
top -bn1 | head -5
echo ""
echo "内存详情："
free -h
echo ""
echo "磁盘空间："
df -h / | tail -1
echo ""

echo "=== 2. PM2进程状态 ==="
pm2 status
echo ""

echo "=== 3. 端口占用情况 ==="
echo "检查3005端口："
lsof -i:3005 2>/dev/null || echo "端口3005未被占用"
echo ""

echo "=== 4. 数据库连接测试 ==="
echo "测试数据库连接（5秒超时）："
timeout 5 npx prisma db execute --stdin <<'EOF' 2>&1 | head -3
SELECT 1 as test;
EOF
echo ""

echo "=== 5. 数据库查询性能测试 ==="
echo "5.1 测试 READY 播客数量查询："
time npx prisma db execute --stdin <<'EOF' 2>&1 | grep -v "^$" | head -5
SELECT COUNT(*) as total FROM "Podcast" WHERE status = 'READY';
EOF
echo ""

echo "5.2 测试 latest 查询（前9个）："
time npx prisma db execute --stdin <<'EOF' 2>&1 | grep -v "^$" | head -10
SELECT id, title, "updatedAt" 
FROM "Podcast" 
WHERE status = 'READY' 
ORDER BY "updatedAt" DESC 
LIMIT 9;
EOF
echo ""

echo "5.3 测试 hot 查询（使用likeCount，前15个）："
time npx prisma db execute --stdin <<'EOF' 2>&1 | grep -v "^$" | head -20
SELECT id, title, "likeCount", "updatedAt" 
FROM "Podcast" 
WHERE status = 'READY' 
  AND "updatedAt" >= NOW() - INTERVAL '30 days'
ORDER BY "likeCount" DESC, "updatedAt" DESC 
LIMIT 15;
EOF
echo ""

echo "=== 6. API响应时间测试 ==="
echo "6.1 Summary API："
time curl -s -m 10 "http://localhost:3005/api/public/summary" > /tmp/summary_test.json 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Summary API响应成功"
  cat /tmp/summary_test.json | head -5
else
  echo "❌ Summary API响应失败或超时"
fi
echo ""

echo "6.2 Latest API："
time curl -s -m 10 "http://localhost:3005/api/public/list?type=latest&limit=9" > /tmp/latest_test.json 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Latest API响应成功"
  cat /tmp/latest_test.json | head -5
else
  echo "❌ Latest API响应失败或超时"
fi
echo ""

echo "6.3 Hot API："
time curl -s -m 10 "http://localhost:3005/api/public/list?type=hot&limit=15" > /tmp/hot_test.json 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Hot API响应成功"
  cat /tmp/hot_test.json | head -5
else
  echo "❌ Hot API响应失败或超时"
fi
echo ""

echo "6.4 Hot All API："
time curl -s -m 10 "http://localhost:3005/api/public/list?type=hot_all&limit=10" > /tmp/hot_all_test.json 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Hot All API响应成功"
  cat /tmp/hot_all_test.json | head -5
else
  echo "❌ Hot All API响应失败或超时"
fi
echo ""

echo "=== 7. 应用日志检查 ==="
echo "7.1 最近的错误日志（最后20行）："
pm2 logs podroom --err --lines 20 --nostream 2>/dev/null | tail -20
echo ""

echo "7.2 最近的超时/慢查询日志："
pm2 logs podroom --out --lines 200 --nostream 2>/dev/null | grep -iE "timeout|slow|超时|查询.*time|query.*time" | tail -10
echo ""

echo "7.3 最近的数据库错误："
pm2 logs podroom --out --lines 200 --nostream 2>/dev/null | grep -iE "P1001|P1017|connection|database.*error|数据库" | tail -10
echo ""

echo "=== 8. 检查likeCount字段 ==="
echo "检查likeCount字段是否存在："
npx prisma db execute --stdin <<'EOF' 2>&1 | grep -v "^$" | head -5
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
EOF
echo ""

echo "=== 9. 检查索引 ==="
echo "检查Podcast表的索引："
npx prisma db execute --stdin <<'EOF' 2>&1 | grep -v "^$" | head -10
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Podcast' 
AND indexname LIKE 'Podcast_%'
ORDER BY indexname;
EOF
echo ""

echo "=========================================="
echo "诊断完成"
echo "=========================================="
echo ""
echo "请将以上输出发送给我，我会分析问题所在。"

