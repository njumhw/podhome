# 线上和本地 .env 配置对比

## 配置检查结果

### ✅ 正确的配置

1. **阿里云OSS配置** - 都正确
   - `ALIYUN_ACCESS_KEY_ID` ✅
   - `ALIYUN_ACCESS_KEY_SECRET` ✅
   - `ALIYUN_OSS_REGION="cn-hangzhou"` ✅ (代码会自动添加`oss-`前缀)
   - `ALIYUN_OSS_BUCKET="ttxxyz"` ✅

2. **其他必需配置** - 都正确
   - `DATABASE_URL` ✅
   - `QWEN_API_KEY` ✅
   - `AUTH_SECRET` ✅
   - `NEXTAUTH_URL` ✅

### ⚠️ 需要注意的问题

1. **`ALIYUN_OSS_ENDPOINT`** - 代码中未使用
   - 线上.env中有这个变量，但代码中没有读取
   - **建议**：可以删除，不影响功能

2. **引号使用不一致**
   - 大部分变量有引号，但`MULERUN_*`变量没有引号
   - **建议**：统一使用引号，避免特殊字符问题

3. **`QWEN_EMBEDDING_API_KEY`** - 本地为空
   - 如果不需要embedding功能，可以保持为空
   - 如果需要，应该设置值

### 📝 推荐的线上 .env 配置

```bash
PORT=3005

# 数据库配置
DATABASE_URL="postgresql://postgres:mwh271678@db.jshrscnivfjcqfsguaic.supabase.co:5432/postgres"

# 应用配置
NODE_ENV="production"
AUTH_SECRET="f7bd1563be4e72e59146dd6f97edd3fd"
ADMIN_DASHBOARD_SECRET="904d7fa9cd5f325575af7546f756f6ba"
NEXTAUTH_URL="http://47.117.77.211:3005"
NEXT_PUBLIC_BASE_URL="http://47.117.77.211:3005"

# 千问配置
QWEN_API_KEY="sk-b34e56d80cad41918166a0f2f9719c77"
QWEN_MODEL_NAME="qwen3-max"
QWEN_EMBEDDING_MODEL="text-embedding-v1"
# QWEN_EMBEDDING_API_KEY=""  # 如果需要embedding功能，取消注释并设置值

# Supabase配置
SUPABASE_URL="https://jshrscnivfjcqfsguaic.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzaHJz..."

# 阿里云配置
ALIYUN_ACCESS_KEY_ID="your_access_key_id"
ALIYUN_ACCESS_KEY_SECRET="your_access_key_secret"
ALIYUN_OSS_REGION="cn-hangzhou"  # 注意：不要带oss-前缀，代码会自动添加
ALIYUN_OSS_BUCKET="ttxxyz"
# ALIYUN_OSS_ENDPOINT="oss-cn-hangzhou.aliyuncs.com"  # 未使用，可删除

# 其他配置
ADMIN_EMAIL="你的邮箱@example.com"
FFMPEG_PATH="ffmpeg"
NEXT_TELEMETRY_DISABLED="1"

# Mulerun配置
MULERUN_AGENT_KEY="ak_7I6ElD2_R1WIGcCKhheBFQAAAZsXEBf3bOwn9By-SMamwpzDUVct8m_fs7GwSEsTkSdPQrCoeK6MvLFfs3i..."
MULERUN_API_BASE_URL="https://api.mulerun.com"
MULERUN_QUERY_COST_CREDITS="100"
MULERUN_SESSION_TIMEOUT_MINUTES="180"
```

## 关键差异说明

### 1. ALIYUN_OSS_REGION 格式

**代码逻辑**：
```typescript
// src/server/storage.ts
const region = OSS_REGION.startsWith('oss-') ? OSS_REGION : `oss-${OSS_REGION}`;
```

**说明**：
- 如果region已经是`oss-cn-hangzhou`格式，直接使用
- 如果是`cn-hangzhou`格式，自动添加`oss-`前缀
- **两种格式都可以，但推荐使用`cn-hangzhou`（不带前缀）**

### 2. 本地 vs 线上差异

| 配置项 | 本地 | 线上 | 说明 |
|--------|------|------|------|
| PORT | 3000 | 3005 | 正常，不同环境可以不同 |
| NODE_ENV | development | production | 正常 |
| NEXTAUTH_URL | localhost:3000 | 47.117.77.211:3005 | 正常 |
| 代理配置 | 有HTTPS_PROXY | 无 | 本地可能需要代理访问外网 |
| QWEN_EMBEDDING_API_KEY | 空 | 未设置 | 如果不需要embedding，可以保持为空 |

## 部署前检查清单

- [x] OSS配置完整（ACCESS_KEY_ID, ACCESS_KEY_SECRET, REGION, BUCKET）
- [x] 数据库连接字符串正确
- [x] QWEN_API_KEY已设置
- [x] AUTH_SECRET已设置
- [x] NEXTAUTH_URL指向正确的服务器地址
- [ ] 确认`ALIYUN_OSS_ENDPOINT`可以删除（代码未使用）
- [ ] 统一引号使用（建议所有值都用引号）

## 总结

**你的线上配置基本正确，只有以下小建议：**

1. **可以删除** `ALIYUN_OSS_ENDPOINT`（代码未使用）
2. **建议统一引号**：给`MULERUN_*`变量也加上引号
3. **确认`QWEN_EMBEDDING_API_KEY`**：如果不需要embedding功能，可以保持不设置

**这些都不是必须的，当前配置应该可以正常工作。**
