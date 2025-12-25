#!/bin/bash
# 验证数据库迁移是否成功

cd /opt/podroom

echo "=========================================="
echo "验证数据库迁移是否成功"
echo "=========================================="
echo ""

echo "=== 1. 验证likeCount字段是否存在 ==="
FIELD_CHECK=$(npx prisma db execute --stdin <<'EOF' 2>&1
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
EOF
)

if echo "$FIELD_CHECK" | grep -q "likeCount"; then
  echo "✅ likeCount字段存在"
  echo "$FIELD_CHECK" | grep -A 5 "likeCount"
else
  echo "❌ likeCount字段不存在！"
  echo "$FIELD_CHECK"
  exit 1
fi

echo ""
echo "=== 2. 验证likeCount数据是否已初始化 ==="
DATA_CHECK=$(npx prisma db execute --stdin <<'EOF' 2>&1
SELECT 
  COUNT(*) as total_podcasts,
  COUNT("likeCount") as podcasts_with_likecount,
  MIN("likeCount") as min_likes,
  MAX("likeCount") as max_likes,
  SUM("likeCount") as total_likes
FROM "Podcast" 
WHERE status = 'READY';
EOF
)

if echo "$DATA_CHECK" | grep -q "total_podcasts"; then
  echo "✅ 数据查询成功"
  echo "$DATA_CHECK"
else
  echo "❌ 数据查询失败"
  echo "$DATA_CHECK"
  exit 1
fi

echo ""
echo "=== 3. 验证索引是否已创建 ==="
INDEX_CHECK=$(npx prisma db execute --stdin <<'EOF' 2>&1
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Podcast' 
AND indexname LIKE 'Podcast_%'
ORDER BY indexname;
EOF
)

echo "检查索引："
REQUIRED_INDEXES=(
  "Podcast_likeCount_idx"
  "Podcast_status_createdAt_idx"
  "Podcast_topicId_status_updatedAt_idx"
  "Podcast_sourceUrl_status_idx"
)

for index in "${REQUIRED_INDEXES[@]}"; do
  if echo "$INDEX_CHECK" | grep -q "$index"; then
    echo "✅ $index 存在"
  else
    echo "❌ $index 不存在！"
  fi
done

echo ""
echo "所有索引："
echo "$INDEX_CHECK" | grep -E "Podcast_" || echo "未找到索引"

echo ""
echo "=== 4. 测试likeCount查询（如果字段不存在会报错）==="
QUERY_TEST=$(npx prisma db execute --stdin <<'EOF' 2>&1
SELECT id, title, "likeCount" 
FROM "Podcast" 
WHERE status = 'READY' 
ORDER BY "likeCount" DESC
LIMIT 5;
EOF
)

if echo "$QUERY_TEST" | grep -qi "error\|does not exist\|column"; then
  echo "❌ 查询失败，字段可能不存在"
  echo "$QUERY_TEST"
  exit 1
else
  echo "✅ likeCount查询成功（字段存在且可查询）"
  echo "$QUERY_TEST" | head -10
fi

echo ""
echo "=== 5. 验证数据一致性（检查likeCount是否等于实际点赞数）==="
CONSISTENCY_CHECK=$(npx prisma db execute --stdin <<'EOF' 2>&1
SELECT 
  p.id,
  p.title,
  p."likeCount" as cached_likes,
  COUNT(pl.id) as actual_likes,
  CASE 
    WHEN p."likeCount" = COUNT(pl.id) THEN '✅ 一致'
    ELSE '❌ 不一致'
  END as status
FROM "Podcast" p
LEFT JOIN "PodcastLike" pl ON pl."podcastId" = p.id
WHERE p.status = 'READY'
GROUP BY p.id, p.title, p."likeCount"
HAVING p."likeCount" != COUNT(pl.id)
LIMIT 10;
EOF
)

if echo "$CONSISTENCY_CHECK" | grep -q "不一致"; then
  echo "⚠️  发现数据不一致的播客："
  echo "$CONSISTENCY_CHECK"
else
  echo "✅ 数据一致性检查通过（或没有不一致的数据）"
fi

echo ""
echo "=== 6. 测试hot查询性能（使用likeCount）==="
echo "执行hot查询测试..."
time npx prisma db execute --stdin <<'EOF' 2>&1 | head -20
SELECT id, title, "likeCount", "updatedAt" 
FROM "Podcast" 
WHERE status = 'READY' 
  AND "updatedAt" >= NOW() - INTERVAL '30 days'
ORDER BY "likeCount" DESC, "updatedAt" DESC 
LIMIT 15;
EOF

echo ""
echo "=========================================="
echo "验证完成"
echo "=========================================="
echo ""
echo "如果所有检查都通过 ✅，说明迁移成功！"
echo "如果有 ❌，请检查Supabase中的SQL执行情况"

