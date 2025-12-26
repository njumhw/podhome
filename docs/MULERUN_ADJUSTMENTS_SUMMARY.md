# MuleRun 界面调整总结

## 调整内容

### 1. ✅ 示例播客改为三个特定播客ID

**修改文件**: `src/app/api/mulerun/examples/route.ts`

**变更内容**:
- 从根据标题匹配改为根据ID精确查找
- 三个示例播客ID：
  - `cmjlt3jhm000gly8izc6i1z86`
  - `cmjl2axe90005lyuqvpj52oes`
  - `cmie7fjg2002glymxlejtstr0`
- 按照ID顺序排序返回

**实现逻辑**:
```typescript
const exampleIds = [
  'cmjlt3jhm000gly8izc6i1z86',
  'cmjl2axe90005lyuqvpj52oes',
  'cmie7fjg2002glymxlejtstr0',
];

const podcasts = await db.podcast.findMany({
  where: {
    status: 'READY',
    id: { in: exampleIds },
  },
  // ...
});

// 按照exampleIds的顺序排序
const sortedPodcasts = exampleIds
  .map(id => podcasts.find(p => p.id === id))
  .filter((p): p is NonNullable<typeof p> => p !== undefined);
```

---

### 2. ✅ 已处理播客卡片移除摘要预览

**修改文件**: `src/app/mulerun/session/page.tsx`

**变更内容**:
- 移除了 `ProcessedPodcastCard` 组件中的摘要预览部分
- 现在只显示：
  - 播客标题
  - 播客作者（如果有）
  - "View Details" 按钮

**修改前**:
```tsx
{query.podcast.summary && (
  <p className="text-sm text-gray-700 line-clamp-3 mb-4 leading-relaxed">
    {query.podcast.summary.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '').substring(0, 120)}...
  </p>
)}
```

**修改后**:
- 已删除摘要预览部分
- 作者信息后的 `mb-3` 改为 `mb-4`，保持间距

---

### 3. ✅ 详情页添加语言切换功能（英文播客）

**修改文件**: `src/app/mulerun/result/[id]/page.tsx`

**变更内容**:
- 添加了 `isEnglishOriginal` 状态管理
- 添加了 `translatedSummary`、`originalTranscript`、`translatedTranscript` 字段支持
- 在摘要区域添加了语言切换按钮（仅英文播客显示）
- 实现了英文/中文总结的切换显示

**新增功能**:
1. **语言切换按钮**:
   - 位置：摘要标题右侧
   - 显示条件：仅当有 `translatedSummary` 时显示
   - 样式：灰色边框，白色背景，hover效果
   - 文本：显示 "EN" 或 "中"

2. **总结显示逻辑**:
   - 如果 `isEnglishOriginal === true` 且有 `translatedSummary`：显示 `summary`（英文总结）
   - 否则：显示 `translatedSummary` 或 `summary`（中文总结）

3. **初始化逻辑**:
   - 如果有 `translatedSummary` 或 `translatedTranscript`：默认显示英文（`isEnglishOriginal = true`）
   - 否则：只显示中文（`isEnglishOriginal = false`）

**代码实现**:
```tsx
// 语言切换按钮（仅英文播客显示）
{podcast.translatedSummary && (
  <button
    onClick={() => setIsEnglishOriginal(!isEnglishOriginal)}
    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-mono border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors"
    title={isEnglishOriginal ? '切换到中文翻译' : '切换到英文原文'}
  >
    <span>{isEnglishOriginal ? 'EN' : '中'}</span>
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  </button>
)}
```

---

### 4. ✅ 处理失败时的计费机制

**问题**: 如果用户提交了一个播客，但是处理失败了，会扣用户的100 credits吗？

**答案**: **不会扣100 credits**

**实现逻辑**:

#### 处理成功时（`handleMulerunQuerySuccess`）:
```typescript
// 报告成本到 Metering API
const reported = await reportMetering(
  session.sessionId,
  meteringId,
  costCredits, // 100 credits
  `Podcast processing completed: ${podcastId}`
);
```

#### 处理失败时（`handleMulerunQueryFailure`）:
```typescript
// 发送 final Metering 报告（0 credits，表示失败）
const meteringId = `failed-${mulerunQueryId}-${Date.now()}`;
await reportMetering(
  session.sessionId,
  meteringId,
  0, // 0 credits，表示失败
  `Podcast processing failed: ${errorMessage}`,
  true // isFinal: true
);

// 更新 costCredits 为 0
await updateQuery(mulerunQueryId, {
  meteringId,
  costCredits: 0,
});
```

#### 超时处理（`processTimeoutQueries`）:
```typescript
// 超时查询也会报告 0 credits
await reportMetering(
  session.sessionId,
  meteringId,
  0, // 0 credits
  `Podcast processing timeout`,
  true // isFinal: true
);
```

**总结**:
- ✅ **处理成功**：报告 100 credits（扣费）
- ✅ **处理失败**：报告 0 credits（不扣费）
- ✅ **处理超时**：报告 0 credits（不扣费）

**代码位置**:
- `src/server/task-queue.ts`: `handleMulerunQuerySuccess` 和 `handleMulerunQueryFailure`
- `src/server/mulerun/session-manager.ts`: `processTimeoutQueries`

---

## 测试建议

### 1. 示例播客测试
- ✅ 验证三个示例播客是否正确显示
- ✅ 验证顺序是否正确
- ✅ 验证如果某个播客不存在，是否正常处理

### 2. 已处理播客卡片测试
- ✅ 验证摘要预览是否已移除
- ✅ 验证标题、作者、按钮是否正常显示
- ✅ 验证点击跳转是否正常

### 3. 语言切换功能测试
- ✅ 验证英文播客是否显示语言切换按钮
- ✅ 验证中文播客是否不显示语言切换按钮
- ✅ 验证切换功能是否正常工作
- ✅ 验证默认显示是否为英文（如果有翻译）

### 4. 计费机制测试
- ✅ 验证处理成功时是否报告 100 credits
- ✅ 验证处理失败时是否报告 0 credits
- ✅ 验证超时时是否报告 0 credits
- ✅ 验证 Metering API 调用是否正确

---

## 代码变更统计

### 修改文件
1. `src/app/api/mulerun/examples/route.ts` - 示例播客改为ID查找
2. `src/app/mulerun/session/page.tsx` - 移除摘要预览
3. `src/app/mulerun/result/[id]/page.tsx` - 添加语言切换功能

### 主要变更
- 示例播客查询逻辑：从标题匹配改为ID精确查找
- 已处理播客卡片：移除摘要预览部分
- 详情页：添加语言切换功能（英文播客）

---

## 注意事项

1. **示例播客ID**：确保这三个播客ID在数据库中存在且状态为 `READY`
2. **语言切换**：仅英文播客（有 `translatedSummary`）显示切换按钮
3. **计费机制**：处理失败和超时都不会扣费，只有成功才扣 100 credits

