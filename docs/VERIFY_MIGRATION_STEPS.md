# 验证数据库迁移是否成功

## 快速验证（推荐）

在服务器上执行：

```bash
cd /opt/podroom
bash scripts/verify-migration-success.sh
```

这个脚本会检查：
1. ✅ likeCount字段是否存在
2. ✅ 数据是否已初始化
3. ✅ 索引是否已创建
4. ✅ 查询是否正常工作
5. ✅ 数据一致性

---

## 手动验证步骤

### 步骤1：检查likeCount字段

```bash
cd /opt/podroom

npx prisma db execute --stdin <<'EOF'
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
EOF
```

**预期输出**：应该看到 `likeCount` 字段，类型为 `integer`，默认值为 `0`

---

### 步骤2：检查数据是否已初始化

```bash
cd /opt/podroom

npx prisma db execute --stdin <<'EOF'
SELECT 
  COUNT(*) as total_podcasts,
  MIN("likeCount") as min_likes,
  MAX("likeCount") as max_likes,
  SUM("likeCount") as total_likes
FROM "Podcast" 
WHERE status = 'READY';
EOF
```

**预期输出**：
- `total_podcasts`: 应该 > 0（你的READY播客数量）
- `min_likes`: 应该 >= 0
- `max_likes`: 应该 >= 0（如果有播客被点赞，应该 > 0）
- `total_likes`: 所有播客的点赞数总和

---

### 步骤3：检查索引是否已创建

```bash
cd /opt/podroom

npx prisma db execute --stdin <<'EOF'
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Podcast' 
AND indexname LIKE 'Podcast_%'
ORDER BY indexname;
EOF
```

**预期输出**：应该看到以下4个索引：
- `Podcast_likeCount_idx`
- `Podcast_status_createdAt_idx`
- `Podcast_topicId_status_updatedAt_idx`
- `Podcast_sourceUrl_status_idx`

---

### 步骤4：测试likeCount查询

```bash
cd /opt/podroom

npx prisma db execute --stdin <<'EOF'
SELECT id, title, "likeCount" 
FROM "Podcast" 
WHERE status = 'READY' 
ORDER BY "likeCount" DESC
LIMIT 5;
EOF
```

**预期输出**：
- 如果字段存在：应该返回5个播客，包含 `likeCount` 值
- 如果字段不存在：会报错 "column 'likeCount' does not exist"

---

### 步骤5：验证数据一致性（可选）

检查likeCount是否等于实际点赞数：

```bash
cd /opt/podroom

npx prisma db execute --stdin <<'EOF'
SELECT 
  p.id,
  p.title,
  p."likeCount" as cached_likes,
  COUNT(pl.id) as actual_likes
FROM "Podcast" p
LEFT JOIN "PodcastLike" pl ON pl."podcastId" = p.id
WHERE p.status = 'READY'
GROUP BY p.id, p.title, p."likeCount"
HAVING p."likeCount" != COUNT(pl.id)
LIMIT 5;
EOF
```

**预期输出**：
- 如果数据一致：应该返回空结果（没有不一致的数据）
- 如果有不一致：会显示不一致的播客列表

---

### 步骤6：测试API查询性能

```bash
cd /opt/podroom

# 测试hot查询（应该很快，< 1秒）
time curl -s "http://localhost:3005/api/public/list?type=hot&limit=15" | head -100

# 测试hot_all查询（应该很快，< 0.1秒）
time curl -s "http://localhost:3005/api/public/list?type=hot_all&limit=10" | head -100
```

**预期输出**：
- hot查询：应该 < 1秒
- hot_all查询：应该 < 0.1秒

---

## 在Supabase中验证

你也可以直接在Supabase SQL Editor中执行以下查询：

### 1. 检查字段

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
```

### 2. 检查索引

```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Podcast' 
AND indexname LIKE 'Podcast_%'
ORDER BY indexname;
```

### 3. 查看数据

```sql
SELECT id, title, "likeCount" 
FROM "Podcast" 
WHERE status = 'READY' 
ORDER BY "likeCount" DESC
LIMIT 10;
```

---

## 常见问题

### Q: 如果字段不存在怎么办？

A: 在Supabase SQL Editor中重新执行创建SQL：

```sql
ALTER TABLE "Podcast" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "Podcast" SET "likeCount" = (SELECT COUNT(*) FROM "PodcastLike" WHERE "PodcastLike"."podcastId" = "Podcast"."id") WHERE "likeCount" = 0;
CREATE INDEX IF NOT EXISTS "Podcast_likeCount_idx" ON "Podcast"("likeCount");
CREATE INDEX IF NOT EXISTS "Podcast_status_createdAt_idx" ON "Podcast"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Podcast_topicId_status_updatedAt_idx" ON "Podcast"("topicId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Podcast_sourceUrl_status_idx" ON "Podcast"("sourceUrl", "status");
```

### Q: 如果索引不存在怎么办？

A: 在Supabase SQL Editor中执行：

```sql
CREATE INDEX IF NOT EXISTS "Podcast_likeCount_idx" ON "Podcast"("likeCount");
CREATE INDEX IF NOT EXISTS "Podcast_status_createdAt_idx" ON "Podcast"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Podcast_topicId_status_updatedAt_idx" ON "Podcast"("topicId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Podcast_sourceUrl_status_idx" ON "Podcast"("sourceUrl", "status");
```

### Q: 如果数据不一致怎么办？

A: 重新初始化likeCount数据：

```sql
UPDATE "Podcast" 
SET "likeCount" = (
  SELECT COUNT(*) 
  FROM "PodcastLike" 
  WHERE "PodcastLike"."podcastId" = "Podcast"."id"
);
```

---

## 验证通过后

如果所有验证都通过，可以安全部署代码：

```bash
cd /opt/podroom

git pull origin main

rm -rf .next

npx prisma generate

NODE_OPTIONS='--max-old-space-size=1536' pnpm build

pm2 restart podroom
```

