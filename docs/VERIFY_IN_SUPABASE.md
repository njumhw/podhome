# 在Supabase中验证迁移（推荐方法）

由于服务器可能无法直接连接数据库，**最可靠的方法是在Supabase Web UI中直接验证**。

---

## 步骤1：打开Supabase SQL Editor

1. 登录 Supabase Dashboard
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New query**

---

## 步骤2：执行验证查询

### 验证1：检查likeCount字段是否存在

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';
```

**预期输出**：
```
column_name | data_type | column_default | is_nullable
------------+-----------+----------------+-------------
likeCount   | integer   | 0              | NO
```

如果看到这个结果，说明字段已创建 ✅

---

### 验证2：检查索引是否已创建

```sql
SELECT indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'Podcast' 
AND indexname LIKE 'Podcast_%'
ORDER BY indexname;
```

**预期输出**：应该看到4个索引：
- `Podcast_likeCount_idx`
- `Podcast_status_createdAt_idx`
- `Podcast_topicId_status_updatedAt_idx`
- `Podcast_sourceUrl_status_idx`

如果看到这4个索引，说明索引已创建 ✅

---

### 验证3：检查数据是否已初始化

```sql
SELECT 
  COUNT(*) as total_podcasts,
  MIN("likeCount") as min_likes,
  MAX("likeCount") as max_likes,
  SUM("likeCount") as total_likes,
  AVG("likeCount")::NUMERIC(10,2) as avg_likes
FROM "Podcast" 
WHERE status = 'READY';
```

**预期输出**：
- `total_podcasts`: 应该 > 0（你的READY播客数量）
- `min_likes`: 应该 >= 0
- `max_likes`: 应该 >= 0（如果有播客被点赞，应该 > 0）
- `total_likes`: 所有播客的点赞数总和

如果数据正常，说明初始化成功 ✅

---

### 验证4：测试likeCount查询

```sql
SELECT id, title, "likeCount", "updatedAt"
FROM "Podcast" 
WHERE status = 'READY' 
ORDER BY "likeCount" DESC, "updatedAt" DESC
LIMIT 10;
```

**预期输出**：应该返回10个播客，每个都有 `likeCount` 值

如果查询成功，说明字段可用 ✅

---

### 验证5：验证数据一致性（可选）

检查likeCount是否等于实际点赞数：

```sql
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
```

**预期输出**：
- 如果数据一致：应该返回空结果（没有不一致的数据）
- 如果有不一致：会显示不一致的播客列表

---

## 如果验证失败

### 如果字段不存在

在Supabase SQL Editor中执行：

```sql
-- 添加字段
ALTER TABLE "Podcast" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0;

-- 初始化数据
UPDATE "Podcast" 
SET "likeCount" = (
  SELECT COUNT(*) 
  FROM "PodcastLike" 
  WHERE "PodcastLike"."podcastId" = "Podcast"."id"
)
WHERE "likeCount" = 0;

-- 创建索引
CREATE INDEX IF NOT EXISTS "Podcast_likeCount_idx" ON "Podcast"("likeCount");
CREATE INDEX IF NOT EXISTS "Podcast_status_createdAt_idx" ON "Podcast"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Podcast_topicId_status_updatedAt_idx" ON "Podcast"("topicId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Podcast_sourceUrl_status_idx" ON "Podcast"("sourceUrl", "status");
```

### 如果索引不存在

在Supabase SQL Editor中执行：

```sql
CREATE INDEX IF NOT EXISTS "Podcast_likeCount_idx" ON "Podcast"("likeCount");
CREATE INDEX IF NOT EXISTS "Podcast_status_createdAt_idx" ON "Podcast"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Podcast_topicId_status_updatedAt_idx" ON "Podcast"("topicId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Podcast_sourceUrl_status_idx" ON "Podcast"("sourceUrl", "status");
```

---

## 验证通过后

如果所有验证都通过 ✅，可以安全部署代码：

```bash
cd /opt/podroom

git pull origin main

rm -rf .next

npx prisma generate

NODE_OPTIONS='--max-old-space-size=1536' pnpm build

pm2 restart podroom
```

---

## 为什么在Supabase中验证？

1. **更可靠**：不依赖服务器网络连接
2. **更直观**：可以直接看到查询结果
3. **更快速**：不需要通过Prisma CLI
4. **更安全**：使用Supabase的Web UI，连接更稳定

