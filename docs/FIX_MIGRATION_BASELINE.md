# 修复 Prisma 迁移基线问题 (P3005)

## 问题说明
数据库已有数据，但 Prisma 迁移历史表可能为空或不完整，导致无法运行迁移。

## 解决方案

### 方案一：手动添加字段并标记迁移为已应用（推荐）

#### 步骤 1：检查字段是否已存在

```bash
# 连接到数据库检查
npx prisma db execute --stdin <<EOF
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name IN ('translatedTranscript', 'translatedSummary');
EOF
```

#### 步骤 2：如果字段不存在，手动添加

```bash
# 执行 SQL 添加字段
npx prisma db execute --stdin <<EOF
-- 为 Podcast 表添加翻译字段
ALTER TABLE "Podcast" 
ADD COLUMN IF NOT EXISTS "translatedTranscript" TEXT,
ADD COLUMN IF NOT EXISTS "translatedSummary" TEXT;

-- 为 AudioCache 表添加翻译字段
ALTER TABLE "AudioCache" 
ADD COLUMN IF NOT EXISTS "translatedTranscript" TEXT,
ADD COLUMN IF NOT EXISTS "translatedSummary" TEXT;
EOF
```

#### 步骤 3：标记迁移为已应用

```bash
# 标记迁移为已应用（跳过执行）
npx prisma migrate resolve --applied 20251223094404_add_translation_fields
```

#### 步骤 4：验证迁移状态

```bash
npx prisma migrate status
```

**预期输出**：
- 应该显示迁移已应用

---

### 方案二：使用 prisma db push（快速但不推荐生产环境）

```bash
# 直接同步 schema 到数据库（不创建迁移记录）
npx prisma db push

# 然后标记迁移为已应用
npx prisma migrate resolve --applied 20251223094404_add_translation_fields
```

**注意**：`db push` 不会创建迁移记录，但会直接修改数据库结构。

---

### 方案三：Baseline 现有数据库（如果迁移历史表完全为空）

```bash
# 1. 检查迁移历史表是否存在
npx prisma db execute --stdin <<EOF
SELECT * FROM "_prisma_migrations" LIMIT 1;
EOF

# 2. 如果表不存在或为空，创建 baseline
npx prisma migrate resolve --applied 20251223094404_add_translation_fields
```

---

## 推荐执行步骤（方案一）

在服务器上执行：

```bash
cd /opt/podroom

# 1. 检查字段是否存在
npx prisma db execute --stdin <<EOF
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name IN ('translatedTranscript', 'translatedSummary');
EOF

# 2. 如果字段不存在，添加字段
npx prisma db execute --stdin <<EOF
ALTER TABLE "Podcast" 
ADD COLUMN IF NOT EXISTS "translatedTranscript" TEXT,
ADD COLUMN IF NOT EXISTS "translatedSummary" TEXT;

ALTER TABLE "AudioCache" 
ADD COLUMN IF NOT EXISTS "translatedTranscript" TEXT,
ADD COLUMN IF NOT EXISTS "translatedSummary" TEXT;
EOF

# 3. 标记迁移为已应用
npx prisma migrate resolve --applied 20251223094404_add_translation_fields

# 4. 验证
npx prisma migrate status
npx prisma generate
```

---

## 验证字段已添加

```bash
# 检查 Podcast 表结构
npx prisma db execute --stdin <<EOF
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Podcast' 
AND column_name IN ('translatedTranscript', 'translatedSummary');
EOF

# 检查 AudioCache 表结构
npx prisma db execute --stdin <<EOF
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'AudioCache' 
AND column_name IN ('translatedTranscript', 'translatedSummary');
EOF
```

**预期输出**：
- 应该看到两个字段：`translatedTranscript` 和 `translatedSummary`，类型为 `text`

---

## 如果仍然失败

如果上述方法都不行，可以：

1. **检查迁移历史表**：
```bash
npx prisma db execute --stdin <<EOF
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;
EOF
```

2. **手动插入迁移记录**（不推荐，但可以作为最后手段）：
```bash
npx prisma db execute --stdin <<EOF
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  '$(uuidgen)',
  '$(echo -n "20251223094404_add_translation_fields" | sha256sum | cut -d" " -f1)',
  NOW(),
  '20251223094404_add_translation_fields',
  NULL,
  NULL,
  NOW(),
  1
);
EOF
```

