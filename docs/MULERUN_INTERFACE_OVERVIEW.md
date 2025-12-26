# MuleRun 界面完整介绍

## 📋 概述

MuleRun 是一个 iframe 嵌入的播客分析 Agent，用户通过 MuleRun 平台访问，无需注册即可使用。界面设计简洁，适配 iframe 环境，与 MuleRun 本体风格保持一致。

---

## 👤 用户相关信息

### 用户认证
- **无需注册**：用户通过 MuleRun 平台访问，不需要在应用中注册账号
- **会话管理**：每个用户会话通过 `sessionId` 和 `userId` 标识
- **会话超时**：3 小时（180 分钟），超过则标记为失败

### 用户数据存储
- **MulerunSession**：存储用户会话信息
  - `sessionId`：MuleRun 平台提供的会话ID
  - `userId`：MuleRun 平台提供的用户ID
  - `agentId`：Agent ID
  - `status`：会话状态（running, completed, expired）
  - `expiresAt`：会话过期时间

- **MulerunQueryHistory**：存储用户的查询历史
  - `queryUrl`：用户输入的播客URL
  - `status`：查询状态（pending, processing, completed, failed, timeout）
  - `podcastId`：关联的播客ID（如果处理成功）
  - `meteringId`：Metering API 的ID（用于计费）
  - `costCredits`：消耗的 credits
  - `error`：错误信息（如果失败）

### 安全机制
- **签名验证**：所有请求必须通过 HMAC SHA-256 签名验证
- **时间戳验证**：防止重放攻击（允许 5 分钟时间差）
- **Agent Key**：用于签名验证和 Metering API 调用（不暴露给前端）

---

## 📚 示例播客

### 示例播客来源
系统会优先查找以下三个示例播客（根据标题匹配）：
1. **014 对谈赵林**
2. **OpenAI首席研究官Mark Chen**
3. **E211 和张云帆聊聊：怎样不靠运气赚钱**

### 示例播客显示逻辑
- 如果找到这三个示例播客，显示它们
- 如果找不到，显示最新的 3 个 READY 状态的播客作为示例
- 示例播客显示在 "Example Podcasts" 区域

### 示例播客信息
每个示例播客卡片显示：
- **标题**：播客标题
- **作者**：播客作者（showAuthor）
- **摘要预览**：summary 的前 120 字符（去除 Markdown 格式）
- **查看详情按钮**：点击跳转到详情页

---

## 🏠 主界面内容（/mulerun/session）

### 界面布局

#### 1. 顶部搜索区域
- **标题**：`Podcast to Insight`
- **搜索框**：
  - 占位符：`Enter podcast URL (e.g., https://www.xiaoyuzhoufm.com/episode/...)`
  - 支持回车键提交
  - 支持粘贴播客URL
- **处理按钮**：
  - 文本：`Process`（处理中显示 `Processing...`）
  - 黑色背景，白色文字
  - 禁用状态：输入为空或正在处理时

#### 2. 已处理的播客（Processed）
- **显示条件**：有状态为 `completed` 且关联了播客的查询
- **布局**：网格布局（响应式：1列/2列/3列）
- **卡片内容**：
  - 播客标题（2行截断）
  - 播客作者
  - 摘要预览（3行截断，去除 Markdown 格式）
  - "View Details" 按钮（带箭头图标）
- **交互**：点击卡片跳转到详情页

#### 3. 示例播客（Example Podcasts）
- **显示条件**：有示例播客数据
- **布局**：网格布局（响应式：1列/2列/3列）
- **卡片内容**：与已处理播客卡片相同
- **交互**：点击卡片跳转到详情页

#### 4. 正在处理的查询（Processing）
- **显示条件**：有状态为 `pending` 或 `processing` 的查询
- **布局**：垂直列表
- **卡片内容**：
  - 创建时间
  - 查询URL（完整显示，可换行）
  - 状态标签（颜色编码）
  - 处理中动画（如果状态为 processing）
  - 错误信息（如果有）
  - 查看详情按钮（如果已完成）

#### 5. 失败的查询（Failed）
- **显示条件**：有状态为 `failed` 或 `timeout` 的查询
- **布局**：垂直列表
- **卡片内容**：
  - 创建时间
  - 查询URL
  - 状态标签（红色/灰色）
  - 错误信息

### 状态轮询
- **轮询间隔**：每 5 秒轮询一次查询状态
- **轮询条件**：只轮询状态为 `pending` 或 `processing` 的查询
- **轮询API**：`/api/mulerun/session?sessionId=xxx`

### 界面风格
- **背景**：白色背景，带像素风格装饰（金色网格，透明度 5%）
- **颜色方案**：
  - 主色调：黑色、白色、金色（#FFD700）
  - 状态颜色：
    - pending: 黄色（bg-yellow-100 text-yellow-800）
    - processing: 蓝色（bg-blue-100 text-blue-800）
    - completed: 绿色（bg-green-100 text-green-800）
    - failed: 红色（bg-red-100 text-red-800）
    - timeout: 灰色（bg-gray-100 text-gray-800）
- **字体**：系统字体，标题加粗
- **响应式**：适配不同屏幕尺寸

---

## 📄 播客详情页（/mulerun/result/[id]）

### 页面布局

#### 1. 标题和作者区域
- **标题**：3xl 字体，加粗，灰色-900
- **作者**：lg 字体，灰色-600（如果有）

#### 2. 音频播放器
- **组件**：`CompactAudioPlayer`
- **显示条件**：有 `audioUrl`
- **功能**：播放、暂停、进度控制

#### 3. 摘要（Summary）
- **标题**：2xl 字体，加粗，"摘要"
- **内容**：Markdown 格式，使用 `ReactMarkdown` 渲染
- **样式**：
  - 段落间距：1.5em
  - 行高：1.8
  - 标题样式：h1 1.875em, h2 1.5em, h3 1.25em
  - 列表样式：1.5em 左边距
  - 代码块：灰色背景，圆角
  - 链接：蓝色，下划线

#### 4. 报告大纲（Report Outline）
- **当前状态**：**已隐藏**（代码中已注释）
- **原因**：MuleRun 界面只显示总结，不显示详细大纲
- **未来**：如果需要显示，可以取消注释

### 页面特点
- **无导航**：不包含 Header、Footer、导航栏等
- **纯内容**：专注于播客内容展示
- **Markdown 渲染**：支持完整的 Markdown 语法（包括 GFM）
- **响应式**：适配不同屏幕尺寸

---

## 💰 付费机制

### 计费方式
- **计费单位**：Credits（积分）
- **每次查询成本**：**100 credits**
- **可配置**：通过环境变量 `MULERUN_QUERY_COST_CREDITS` 调整

### Metering API 集成
- **API 端点**：`https://api.mulerun.com/v1/metering`
- **调用时机**：
  1. **处理成功**：报告 100 credits
  2. **处理失败/超时**：报告 0 credits（表示失败）

### 计费流程

#### 1. 查询提交
```
用户输入播客URL
  ↓
创建 MulerunQueryHistory（status: pending）
  ↓
生成 meteringId（UUID）
  ↓
提交到 TaskQueue 处理
```

#### 2. 处理成功
```
播客处理完成
  ↓
更新状态（status: completed）
  ↓
调用 Metering API（100 credits）
  ↓
更新 costCredits = 100
```

#### 3. 处理失败/超时
```
处理失败或超时（3小时）
  ↓
更新状态（status: failed/timeout）
  ↓
调用 Metering API（0 credits，isFinal: true）
  ↓
更新 costCredits = 0
```

### 并发控制
- **限制**：同一会话只能有一个并发查询
- **检查**：提交新查询时检查是否有 `pending` 或 `processing` 状态的查询
- **错误**：如果有并发查询，返回 429 错误

### 超时机制
- **超时时间**：3 小时（180 分钟）
- **超时检查**：后台任务定期检查超时的查询
- **超时处理**：
  1. 标记为 `timeout`
  2. 调用 Metering API（0 credits，isFinal: true）
  3. 更新会话状态（如果所有查询都完成）

### 缓存机制
- **已处理播客**：如果播客已存在（相同 sourceUrl），直接返回结果
- **不重复计费**：缓存结果不消耗 credits
- **用户体验**：立即显示结果，无需等待

---

## 🔧 技术实现

### 路由设计
- `/mulerun/session`：主界面（Start Session URL）
- `/mulerun/result/[id]`：播客详情页
- `/api/mulerun/session`：会话管理 API
- `/api/mulerun/process`：播客处理 API
- `/api/mulerun/examples`：示例播客 API

### 数据库 Schema
- **MulerunSession**：会话表
- **MulerunQueryHistory**：查询历史表
- **Podcast**：播客表（共享，通过 `mulerunQueries` 关联）

### 环境变量
```bash
MULERUN_AGENT_KEY=mck-xxx          # Agent Key
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100    # 每次查询成本
MULERUN_SESSION_TIMEOUT_MINUTES=180 # 会话超时
```

### 安全机制
- **签名验证**：HMAC SHA-256
- **时间戳验证**：防止重放攻击
- **HTTP Headers**：
  - `X-Frame-Options: ALLOW-FROM https://mulerun.com`
  - `Content-Security-Policy: frame-ancestors 'self' https://mulerun.com;`

---

## 📊 数据流程

### 用户使用流程
```
1. MuleRun 平台打开 Start Session URL
   ↓
2. 验证签名，创建/恢复会话
   ↓
3. 显示主界面（搜索框 + 示例播客）
   ↓
4. 用户输入播客URL，点击 Process
   ↓
5. 提交查询，创建 MulerunQueryHistory
   ↓
6. 后台处理播客（ASR + AI 总结）
   ↓
7. 处理完成，更新状态，调用 Metering API
   ↓
8. 前端轮询更新，显示结果
   ↓
9. 用户点击查看详情，跳转到详情页
```

### 状态流转
```
pending → processing → completed
                    ↓
                  failed/timeout
```

---

## 🎨 UI/UX 特点

### 设计原则
- **简洁**：去除所有不适合 iframe 的元素
- **一致**：与 MuleRun 本体风格保持一致
- **响应式**：适配不同屏幕尺寸
- **清晰**：状态明确，错误信息友好

### 交互特点
- **实时更新**：5 秒轮询查询状态
- **即时反馈**：处理中显示动画
- **错误处理**：友好的错误提示
- **缓存优化**：已处理播客立即显示

---

## 📝 总结

MuleRun 界面是一个简洁、高效的播客分析工具，通过 iframe 嵌入 MuleRun 平台，为用户提供：
- ✅ 无需注册，即开即用
- ✅ 快速处理，3-10 分钟完成
- ✅ 结构化输出，便于理解
- ✅ 清晰的计费机制，100 credits/次
- ✅ 友好的用户体验，实时状态更新

