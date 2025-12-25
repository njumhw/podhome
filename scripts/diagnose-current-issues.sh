#!/bin/bash
# 诊断当前问题：hot查询失败和播客详情页超时

cd /opt/podroom

echo "=========================================="
echo "问题诊断：hot查询失败和播客详情页超时"
echo "=========================================="
echo ""

echo "=== 问题1：最近30天的hot查询 ==="
echo ""

echo "1.1 测试hot查询API（30天）"
echo "----------------------------------------"
time curl -s "http://localhost:3005/api/public/list?type=hot&limit=15" > /tmp/hot_test.json 2>&1
if [ $? -eq 0 ]; then
  echo "✅ API请求成功"
  ITEM_COUNT=$(cat /tmp/hot_test.json | jq '.items | length' 2>/dev/null || echo "无法解析JSON")
  echo "返回的播客数量: $ITEM_COUNT"
  if [ "$ITEM_COUNT" = "0" ] || [ "$ITEM_COUNT" = "null" ]; then
    echo "❌ 返回空数据"
    echo "返回内容:"
    cat /tmp/hot_test.json | head -20
  else
    echo "✅ 返回数据正常"
    echo "前3个播客的likeCount:"
    cat /tmp/hot_test.json | jq '.items[0:3] | .[] | {id, title, likeCount}' 2>/dev/null || echo "无法解析"
  fi
else
  echo "❌ API请求失败"
  cat /tmp/hot_test.json | head -20
fi

echo ""
echo "1.2 测试hot_all查询API（全量）"
echo "----------------------------------------"
time curl -s "http://localhost:3005/api/public/list?type=hot_all&limit=10" > /tmp/hot_all_test.json 2>&1
if [ $? -eq 0 ]; then
  echo "✅ API请求成功"
  ITEM_COUNT=$(cat /tmp/hot_all_test.json | jq '.items | length' 2>/dev/null || echo "无法解析JSON")
  echo "返回的播客数量: $ITEM_COUNT"
  if [ "$ITEM_COUNT" = "0" ] || [ "$ITEM_COUNT" = "null" ]; then
    echo "❌ 返回空数据"
  else
    echo "✅ 返回数据正常"
  fi
else
  echo "❌ API请求失败"
fi

echo ""
echo "1.3 检查hot查询相关日志"
echo "----------------------------------------"
pm2 logs podroom --out --lines 300 --nostream 2>/dev/null | grep -iE "hot|热门|likeCount|orderBy" | tail -20

echo ""
echo "=== 问题2：播客详情页超时 ==="
echo ""

echo "2.1 获取一个播客ID"
echo "----------------------------------------"
PODCAST_ID=$(curl -s "http://localhost:3005/api/public/list?type=latest&limit=1" | jq -r '.items[0].id' 2>/dev/null)
if [ -z "$PODCAST_ID" ] || [ "$PODCAST_ID" = "null" ]; then
  echo "❌ 无法获取播客ID"
  echo "使用默认ID: cmjl2axe90005lyuqvpj52oes"
  PODCAST_ID="cmjl2axe90005lyuqvpj52oes"
else
  echo "✅ 获取到播客ID: $PODCAST_ID"
fi

echo ""
echo "2.2 测试播客详情API"
echo "----------------------------------------"
time curl -s -m 35 "http://localhost:3005/api/public/podcast?id=$PODCAST_ID" > /tmp/podcast_detail_test.json 2>&1
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ API请求成功（退出码: $EXIT_CODE）"
  ERROR_MSG=$(cat /tmp/podcast_detail_test.json | jq -r '.error' 2>/dev/null || echo "")
  if [ -n "$ERROR_MSG" ] && [ "$ERROR_MSG" != "null" ]; then
    echo "❌ API返回错误: $ERROR_MSG"
    cat /tmp/podcast_detail_test.json | head -10
  else
    TITLE=$(cat /tmp/podcast_detail_test.json | jq -r '.title' 2>/dev/null || echo "")
    if [ -n "$TITLE" ] && [ "$TITLE" != "null" ]; then
      echo "✅ 返回数据正常，标题: $TITLE"
    else
      echo "⚠️  返回数据可能不完整"
      cat /tmp/podcast_detail_test.json | head -10
    fi
  fi
elif [ $EXIT_CODE -eq 124 ] || [ $EXIT_CODE -eq 28 ]; then
  echo "❌ API请求超时（退出码: $EXIT_CODE）"
  echo "返回内容:"
  cat /tmp/podcast_detail_test.json | head -20
else
  echo "❌ API请求失败（退出码: $EXIT_CODE）"
  cat /tmp/podcast_detail_test.json | head -20
fi

echo ""
echo "2.3 检查播客详情查询相关日志"
echo "----------------------------------------"
pm2 logs podroom --out --lines 300 --nostream 2>/dev/null | grep -iE "podcast.*detail|播客详情|podcast.*id|timeout|超时|P1001|P1017" | tail -20

echo ""
echo "2.4 检查数据库连接"
echo "----------------------------------------"
pm2 logs podroom --out --lines 200 --nostream 2>/dev/null | grep -iE "connection|database|P1001|P1017|连接" | tail -10

echo ""
echo "=========================================="
echo "诊断完成"
echo "=========================================="
echo ""
echo "请将以上输出发送给我，我会分析问题并精准修复。"

