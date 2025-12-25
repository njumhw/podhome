#!/bin/bash
# 通过API测试验证数据库迁移是否成功

cd /opt/podroom

echo "=========================================="
echo "通过API测试验证数据库迁移"
echo "=========================================="
echo ""

echo "=== 1. 测试hot查询（如果likeCount不存在，查询会失败或很慢）==="
echo "执行hot查询..."
HOT_RESULT=$(time curl -s -m 10 "http://localhost:3005/api/public/list?type=hot&limit=15" 2>&1)
HOT_TIME=$(echo "$HOT_RESULT" | grep "^real" | awk '{print $2}')

if echo "$HOT_RESULT" | grep -q '"items"'; then
  echo "✅ Hot API查询成功"
  echo "响应时间: $HOT_TIME"
  echo "$HOT_RESULT" | grep -o '"likeCount":[0-9]*' | head -5
else
  echo "❌ Hot API查询失败"
  echo "$HOT_RESULT" | head -20
fi

echo ""
echo "=== 2. 测试hot_all查询（使用likeCount排序）==="
echo "执行hot_all查询..."
HOT_ALL_RESULT=$(time curl -s -m 10 "http://localhost:3005/api/public/list?type=hot_all&limit=10" 2>&1)
HOT_ALL_TIME=$(echo "$HOT_ALL_RESULT" | grep "^real" | awk '{print $2}')

if echo "$HOT_ALL_RESULT" | grep -q '"items"'; then
  echo "✅ Hot All API查询成功"
  echo "响应时间: $HOT_ALL_TIME"
  echo "$HOT_ALL_RESULT" | grep -o '"likeCount":[0-9]*' | head -5
else
  echo "❌ Hot All API查询失败"
  echo "$HOT_ALL_RESULT" | head -20
fi

echo ""
echo "=== 3. 检查应用日志（查看是否有likeCount相关错误）==="
ERRORS=$(pm2 logs podroom --out --lines 100 --nostream 2>/dev/null | grep -iE "likeCount|column.*not exist|does not exist" | tail -5)

if [ -z "$ERRORS" ]; then
  echo "✅ 没有发现likeCount相关错误"
else
  echo "⚠️  发现可能的错误："
  echo "$ERRORS"
fi

echo ""
echo "=========================================="
echo "验证完成"
echo "=========================================="
echo ""
echo "如果API查询成功且响应时间 < 1秒，说明迁移成功！"

