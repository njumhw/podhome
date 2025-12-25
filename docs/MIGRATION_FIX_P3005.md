# 修复 Prisma 迁移 P3005 错误

## 问题
```
Error: P3005
The database schema is not empty. Read more about how to baseline an existing production database
```

## 原因
数据库已有数据，但 Prisma 迁移历史表状态不一致。

## 解决方案（推荐：手动执行 SQL）

### 步骤 1：检查字段是否已存在

```bash
cd /opt/podroom

# 检查 likeCount 字段是否存在
npx prisma db execute --stdin <<'EOF'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
EOF
```

**如果已有输出**：说明字段已存在，跳到步骤 3。

**如果没有输出**：继续步骤 2。

---

### 步骤 2：手动执行迁移 SQL

```bash
cd /opt/podroom

# 执行迁移 SQL（安全：使用 IF NOT EXISTS）
npx prisma db execute --stdin <<'EOF'
-- Step 1: Add the likeCount column with default value 0
ALTER TABLE "Podcast" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0;

-- Step 2: Initialize likeCount for existing podcasts
UPDATE "Podcast" 
SET "likeCount" = (
  SELECT COUNT(*) 
  FROM "PodcastLike" 
  WHERE "PodcastLike"."podcastId" = "Podcast"."id"
)
WHERE "likeCount" = 0; -- 只更新为0的记录，避免重复更新

-- Step 3: Create indexes for query optimization
CREATE INDEX IF NOT EXISTS "Podcast_likeCount_idx" ON "Podcast"("likeCount");
CREATE INDEX IF NOT EXISTS "Podcast_status_createdAt_idx" ON "Podcast"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Podcast_topicId_status_updatedAt_idx" ON "Podcast"("topicId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Podcast_sourceUrl_status_idx" ON "Podcast"("sourceUrl", "status");
EOF
```

---

### 步骤 3：标记迁移为已应用

```bash
cd /opt/podroom

# 标记迁移为已应用（告诉 Prisma 这个迁移已经执行过了）
npx prisma migrate resolve --applied 20251225205805_add_like_count_field
```

---

### 步骤 4：验证迁移状态

```bash
cd /opt/podroom

# 检查迁移状态
npx prisma migrate status

# 验证字段和索引
npx prisma db execute --stdin <<'EOF'
-- 检查字段
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';

-- 检查索引
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Podcast' 
AND indexname LIKE 'Podcast_%'
ORDER BY indexname;
EOF
```

**预期输出**：
- 应该看到 `likeCount` 字段（类型：integer，默认值：0）
- 应该看到 4 个索引：
  - `Podcast_likeCount_idx`
  - `Podcast_status_createdAt_idx`
  - `Podcast_topicId_status_updatedAt_idx`
  - `Podcast_sourceUrl_status_idx`

---

## 如果步骤 3 失败（网络问题）

如果 `prisma migrate resolve` 因为网络问题失败，可以：

### 方案 A：使用 db push（快速但不记录迁移历史）

```bash
cd /opt/podroom

# 直接同步 schema（不会创建迁移记录）
npx prisma db push --accept-data-loss

# 然后标记迁移为已应用
npx prisma migrate resolve --applied 20251225205805_add_like_count_field
```

### 方案 B：手动插入迁移记录（不推荐，但可以作为最后手段）

```bash
cd /opt/podroom

# 手动插入迁移记录到 _prisma_migrations 表
npx prisma db execute --stdin <<'EOF'
INSERT INTO "_prisma_migrations" (
  id, 
  checksum, 
  finished_at, 
  migration_name, 
  logs, 
  rolled_back_at, 
  started_at, 
  applied_steps_count
)
VALUES (
  gen_random_uuid()::text,
  'manual_baseline',
  NOW(),
  '20251225205805_add_like_count_field',
  NULL,
  NULL,
  NOW(),
  1
)
ON CONFLICT (migration_name) DO NOTHING;
EOF
```

---

## 完整执行脚本（一键执行）

```bash
cd /opt/podroom

# 一键执行所有步骤
cat <<'SCRIPT' | bash
set -e  # 遇到错误立即退出

echo "=== 步骤 1: 检查字段是否存在 ==="
FIELD_EXISTS=$(npx prisma db execute --stdin <<'EOF' 2>/dev/null | grep -c likeCount || echo "0")
SELECT column_name FROM information_schema.columns WHERE table_name = 'Podcast' AND column_name = 'likeCount';
EOF

if [ "$FIELD_EXISTS" -gt 0 ]; then
  echo "✅ likeCount 字段已存在，跳过添加"
else
  echo "=== 步骤 2: 执行迁移 SQL ==="
  npx prisma db execute --stdin <<'EOF'
ALTER TABLE "Podcast" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "Podcast" SET "likeCount" = (SELECT COUNT(*) FROM "PodcastLike" WHERE "PodcastLike"."podcastId" = "Podcast"."id") WHERE "likeCount" = 0;
CREATE INDEX IF NOT EXISTS "Podcast_likeCount_idx" ON "Podcast"("likeCount");
CREATE INDEX IF NOT EXISTS "Podcast_status_createdAt_idx" ON "Podcast"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Podcast_topicId_status_updatedAt_idx" ON "Podcast"("topicId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Podcast_sourceUrl_status_idx" ON "Podcast"("sourceUrl", "status");
EOF
  echo "✅ 迁移 SQL 执行完成"
fi

echo "=== 步骤 3: 标记迁移为已应用 ==="
npx prisma migrate resolve --applied 20251225205805_add_like_count_field || echo "⚠️  标记失败（可能已标记），继续..."

echo "=== 步骤 4: 验证迁移状态 ==="
npx prisma migrate status

echo "✅ 迁移完成！"
SCRIPT
```

---

## 验证迁移成功

执行以下命令验证：

```bash
cd /opt/podroom

# 1. 检查迁移状态
npx prisma migrate status

# 2. 检查字段
npx prisma db execute --stdin <<'EOF'
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
EOF

# 3. 检查索引
npx prisma db execute --stdin <<'EOF'
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Podcast' 
AND indexname LIKE 'Podcast_%'
ORDER BY indexname;
EOF

# 4. 检查数据（验证 likeCount 是否正确初始化）
npx prisma db execute --stdin <<'EOF'
SELECT id, title, "likeCount" 
FROM "Podcast" 
WHERE status = 'READY' 
ORDER BY "likeCount" DESC 
LIMIT 5;
EOF
```

---

## 继续部署流程

迁移完成后，继续执行：

```bash
cd /opt/podroom

# 继续构建和重启
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
pm2 restart podroom
```

---

## 注意事项

1. **安全性**：所有 SQL 都使用 `IF NOT EXISTS`，可以安全重复执行
2. **数据完整性**：UPDATE 语句只更新 `likeCount = 0` 的记录，避免重复计算
3. **索引创建**：使用 `IF NOT EXISTS`，不会重复创建
4. **迁移历史**：标记迁移为已应用后，Prisma 会记录迁移状态

