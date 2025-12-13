# 数据库迁移问题修复

## 问题描述

运行 `npx prisma migrate deploy` 时出现错误：
```
Error: P3005
The database schema is not empty. Read more about how to baseline an existing production database
```

## 原因

这是因为：
1. 数据库已经有现有的表和数据
2. Prisma 迁移系统找不到对应的迁移文件
3. Prisma 无法确定如何安全地应用迁移

## 解决方案

对于已有数据库，应该使用 `prisma db push` 来同步 schema，而不是 `prisma migrate deploy`。

### 步骤 1: 使用 db push 同步 schema

```bash
# 在服务器上执行
cd /opt/podroom
npx prisma db push
```

这个命令会：
- 比较 Prisma schema 和数据库当前状态
- 自动生成并应用必要的 SQL 变更
- **不会**创建迁移文件（适合已有数据库）

### 步骤 2: 验证表是否创建成功

```bash
# 检查表是否存在（如果使用 PostgreSQL）
npx prisma studio
# 或者直接查询数据库
```

### 步骤 3: 如果 db push 也失败

如果 `db push` 也失败，可以手动创建表：

```bash
# 使用 Prisma 生成 SQL
npx prisma migrate dev --create-only --name add_mulerun_tables

# 这会创建一个迁移文件，但不应用
# 然后手动执行 SQL
```

或者直接使用 SQL：

```sql
-- 在 Supabase 或其他数据库管理工具中执行

-- 创建 MulerunSession 表
CREATE TABLE IF NOT EXISTS "MulerunSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "MulerunSession_sessionId_idx" ON "MulerunSession"("sessionId");
CREATE INDEX IF NOT EXISTS "MulerunSession_userId_idx" ON "MulerunSession"("userId");
CREATE INDEX IF NOT EXISTS "MulerunSession_expiresAt_idx" ON "MulerunSession"("expiresAt");

-- 创建 MulerunQueryHistory 表
CREATE TABLE IF NOT EXISTS "MulerunQueryHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "podcastId" TEXT,
    "queryUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "meteringId" TEXT UNIQUE,
    "costCredits" DOUBLE PRECISION,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3),
    CONSTRAINT "MulerunQueryHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MulerunSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MulerunQueryHistory_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "MulerunQueryHistory_sessionId_idx" ON "MulerunQueryHistory"("sessionId");
CREATE INDEX IF NOT EXISTS "MulerunQueryHistory_status_idx" ON "MulerunQueryHistory"("status");
CREATE INDEX IF NOT EXISTS "MulerunQueryHistory_timeoutAt_idx" ON "MulerunQueryHistory"("timeoutAt");
```

## 推荐方案

**对于生产环境，推荐使用 `prisma db push`**：

```bash
# 1. 确保 .env 文件中的 DATABASE_URL 正确
# 2. 运行 db push
npx prisma db push

# 3. 生成 Prisma Client
npx prisma generate
```

## 注意事项

- `prisma db push` 会直接修改数据库，不会创建迁移文件
- 适合开发环境或已有数据库的 schema 同步
- 如果团队需要版本控制的迁移文件，应该先 baseline 数据库

