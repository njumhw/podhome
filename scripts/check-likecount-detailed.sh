#!/bin/bash
# 详细检查likeCount字段

cd /opt/podroom

echo "=== 检查1: 查看likeCount字段定义 ==="
npx prisma db execute --stdin <<'EOF'
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
EOF

echo ""
echo "=== 检查2: 查看Podcast表的所有字段（查找like相关）==="
npx prisma db execute --stdin <<'EOF'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND (column_name LIKE '%like%' OR column_name LIKE '%Like%')
ORDER BY column_name;
EOF

echo ""
echo "=== 检查3: 直接查询likeCount值（查看是否有数据）==="
npx prisma db execute --stdin <<'EOF'
SELECT COUNT(*) as total_podcasts,
       COUNT("likeCount") as podcasts_with_likecount,
       MIN("likeCount") as min_likes,
       MAX("likeCount") as max_likes,
       AVG("likeCount")::INTEGER as avg_likes
FROM "Podcast" 
WHERE status = 'READY';
EOF

echo ""
echo "=== 检查4: 查看前5个播客的likeCount值 ==="
npx prisma db execute --stdin <<'EOF'
SELECT id, title, "likeCount", status
FROM "Podcast" 
WHERE status = 'READY' 
ORDER BY "updatedAt" DESC
LIMIT 5;
EOF

