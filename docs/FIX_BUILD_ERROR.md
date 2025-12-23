# 修复构建错误 - translatedTranscript 类型错误

## 问题
构建时报错：`translatedTranscript does not exist in type 'AudioCacheData'`

## 解决方案

### 步骤 1：确认文件已更新

```bash
cd /opt/podroom

# 检查 audio-cache.ts 文件是否包含新字段
grep -n "translatedTranscript" src/server/audio-cache.ts
```

**预期输出**：应该看到 `translatedTranscript` 字段定义

### 步骤 2：如果文件未更新，手动修复

```bash
# 编辑文件
nano src/server/audio-cache.ts
```

找到 `export interface AudioCacheData` 部分（大约第 3 行），添加：

```typescript
export interface AudioCacheData {
	title?: string;
	author?: string;
	duration?: number;
	transcript?: string;
	script?: string;
	summary?: string;
	report?: string;
	translatedTranscript?: string; // 添加这一行
	translatedSummary?: string; // 添加这一行
	segments?: string[];
	originalUrl?: string;
	publishedAt?: string;
	metadata?: any;
}
```

然后在 `getCachedAudio` 函数的返回对象中添加（大约第 36 行）：

```typescript
return {
	// ... 其他字段 ...
	translatedTranscript: cached.translatedTranscript || undefined,
	translatedSummary: cached.translatedSummary || undefined,
	// ... 其他字段 ...
};
```

在 `setCachedAudio` 函数的 `update` 和 `create` 部分都添加（大约第 60 和 74 行）：

```typescript
translatedTranscript: data.translatedTranscript,
translatedSummary: data.translatedSummary,
```

### 步骤 3：清理缓存并重新构建

```bash
# 清理 Next.js 缓存
rm -rf .next

# 清理 node_modules/.cache
rm -rf node_modules/.cache

# 重新生成 Prisma Client
npx prisma generate

# 重新构建
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

### 步骤 4：如果还是失败，检查文件内容

```bash
# 查看完整的 AudioCacheData 接口
cat src/server/audio-cache.ts | grep -A 15 "export interface AudioCacheData"
```

确保包含 `translatedTranscript` 和 `translatedSummary` 字段。

