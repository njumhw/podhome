# Supabase 直接执行迁移 SQL

## 使用场景
当服务器无法通过命令行连接数据库时，可以直接在 Supabase Web UI 中执行 SQL。

## 执行步骤

### 1. 打开 Supabase SQL Editor
1. 登录 Supabase Dashboard
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New query**

### 2. 复制并执行以下 SQL

```sql
-- ============================================
-- 添加 likeCount 字段和索引（性能优化）
-- ============================================

-- Step 1: 添加 likeCount 字段
ALTER TABLE "Podcast" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0;

-- Step 2: 初始化现有播客的 likeCount（计算每个播客的实际点赞数）
UPDATE "Podcast" 
SET "likeCount" = (
  SELECT COUNT(*) 
  FROM "PodcastLike" 
  WHERE "PodcastLike"."podcastId" = "Podcast"."id"
)
WHERE "likeCount" = 0; -- 只更新为0的记录，避免重复计算

-- Step 3: 创建索引（提升查询性能）
CREATE INDEX IF NOT EXISTS "Podcast_likeCount_idx" ON "Podcast"("likeCount");
CREATE INDEX IF NOT EXISTS "Podcast_status_createdAt_idx" ON "Podcast"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Podcast_topicId_status_updatedAt_idx" ON "Podcast"("topicId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Podcast_sourceUrl_status_idx" ON "Podcast"("sourceUrl", "status");
```

### 3. 点击 "Run" 执行

**预期结果**：
- ✅ 应该显示 "Success. No rows returned"
- ✅ 或者显示受影响的行数

---

## 验证 SQL 执行成功

在 Supabase SQL Editor 中执行以下验证查询：

```sql
-- 验证 1: 检查字段是否存在
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name = 'likeCount';

-- 验证 2: 检查索引是否存在
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Podcast' 
AND indexname LIKE 'Podcast_%'
ORDER BY indexname;

-- 验证 3: 检查数据（查看前5个播客的点赞数）
SELECT id, title, "likeCount" 
FROM "Podcast" 
WHERE status = 'READY' 
ORDER BY "likeCount" DESC 
LIMIT 5;
```

**预期输出**：
- 验证 1：应该看到 `likeCount` 字段（类型：integer，默认值：0）
- 验证 2：应该看到 4 个索引
- 验证 3：应该看到播客列表及其点赞数

---

## 标记迁移为已应用（可选）

如果后续网络恢复，可以在服务器上执行：

```bash
cd /opt/podroom

# 标记迁移为已应用
npx prisma migrate resolve --applied 20251225205805_add_like_count_field

# 验证迁移状态
npx prisma migrate status
```

**注意**：如果网络一直有问题，可以跳过这一步，直接继续构建。字段和索引已经创建，应用可以正常使用。

---

## 继续部署流程

SQL 执行成功后，在服务器上继续：

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
4. **执行顺序**：必须按顺序执行（先添加字段，再初始化数据，最后创建索引）

