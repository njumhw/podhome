#!/bin/bash
# 检查likeCount字段是否存在

cd /opt/podroom

echo "=== 检查likeCount字段 ==="
echo ""

echo "方法1: 查询字段信息"
npx prisma db execute --stdin <<'EOF'
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
EOF

echo ""
echo "方法2: 查看所有字段（查找likeCount）"
npx prisma db execute --stdin <<'EOF'
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name LIKE '%like%'
ORDER BY column_name;
EOF

echo ""
echo "方法3: 尝试查询likeCount（如果字段不存在会报错）"
npx prisma db execute --stdin <<'EOF'
SELECT id, title, "likeCount" 
FROM "Podcast" 
WHERE status = 'READY' 
LIMIT 1;
EOF

