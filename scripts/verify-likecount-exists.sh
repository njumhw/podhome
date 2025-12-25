#!/bin/bash
# 验证likeCount字段是否存在

cd /opt/podroom

echo "=== 方法1: 查询likeCount字段信息 ==="
npx prisma db execute --stdin <<'EOF'
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
EOF

echo ""
echo "=== 方法2: 查看所有包含'like'的字段 ==="
npx prisma db execute --stdin <<'EOF'
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name LIKE '%like%'
ORDER BY column_name;
EOF

echo ""
echo "=== 方法3: 尝试直接查询likeCount（如果字段不存在会报错）==="
npx prisma db execute --stdin <<'EOF'
SELECT id, title, "likeCount" 
FROM "Podcast" 
WHERE status = 'READY' 
LIMIT 1;
EOF

echo ""
echo "=== 方法4: 查看Podcast表的所有字段（确认likeCount是否在列表中）==="
npx prisma db execute --stdin <<'EOF'
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
ORDER BY column_name;
EOF

