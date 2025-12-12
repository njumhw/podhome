# MuleRun Iframe Agent 实现方案（严格按照官方文档）

## 📚 参考文档

- [MuleRun Iframe Agent Specs](https://mulerun.com/docs/creator-guide/agent/iframe-agent-spec)
- [MuleRun Metering API](https://mulerun.com/docs/creator-guide/agent/iframe-agent-spec#metering-apis)

---

## ✅ 已确认的业务决策

1. **成本定价**：100 credits/次（后续可通过环境变量调整）
2. **会话超时**：3 小时（180 分钟），超过则标记为失败
3. **分享功能**：暂不实现 Share Session URL（先实现基础功能）
4. **UI 风格**：与 MuleRun 本体风格保持一致，移除所有不适合 iframe 的元素

---

## 🏗️ 实现架构

### 路由设计（严格按照文档）

```
/mulerun/session          # Start Session URL（必需）
  - 接收 MuleRun 的 iframe 请求
  - 验证签名
  - 创建/恢复会话
  - 显示处理界面

/mulerun/api/verify       # 签名验证 API（内部使用）
/mulerun/api/metering     # Metering API 代理（可选，直接调用官方 API）
```

### 数据库 Schema（已存在，符合要求）

- ✅ `MulerunSession`：存储会话信息
- ✅ `MulerunQueryHistory`：存储查询历史
- ✅ `Podcast`：共享播客数据（已有 `mulerunQueries` 关联）

---

## 🔐 签名验证实现（严格按照文档）

### 文档要求

> **Note:** All parameters are URL-encoded during transmission. During signature verification, they must be URL-decoded, parsed into a dictionary, sorted, and serialized as JSON before HMAC calculation.

### 实现步骤

1. **URL 解码所有参数**
2. **移除 signature 参数**
3. **按 key 排序**
4. **序列化为 JSON**（使用 `separators=(',', ':')`，`sort_keys=True`）
5. **计算 HMAC SHA-256**（使用 Agent Key 作为密钥）
6. **比较签名**（64 字符的 hex 字符串）

### Python 参考实现（文档提供）

```python
import json
import hmac
from hashlib import sha256

# URL 解码所有参数
decoded_params = {k: urllib.parse.unquote(v) for k, v in params.items()}

# 移除 signature
decoded_params.pop('signature', None)

# 排序并序列化
sorted_json = json.dumps(decoded_params, separators=(',', ':'), sort_keys=True)

# 计算 HMAC
signature = hmac.new(
    agent_key.encode(),
    sorted_json.encode(),
    sha256
).hexdigest()

# 验证
return signature == received_signature
```

---

## 📊 Metering API 集成（严格按照文档）

### API 端点

- **报告成本**：`POST https://api.mulerun.com/sessions/metering`
- **查询状态**：`GET https://api.mulerun.com/sessions/metering/{sessionId}`

### 请求格式

```typescript
POST https://api.mulerun.com/sessions/metering
Headers:
  Authorization: Bearer {agent_key}
  Content-Type: application/json
Body:
{
  sessionId: string,
  meteringId: string,  // 幂等 ID（唯一）
  credits: number,     // 成本（100 credits = 0.01）
  description?: string,
  isFinal?: boolean    // 标记为最终报告，终止会话
}
```

### 实现要点

1. **幂等性**：使用 `meteringId` 确保不会重复计费
2. **错误处理**：网络错误时重试，但确保幂等性
3. **超时处理**：3 小时后标记查询为 `timeout`，发送 final 报告

---

## 🎨 UI 适配要求（严格按照文档）

### 必须移除的元素

1. ✅ 会话/聊天历史
2. ✅ 项目/工作区管理
3. ✅ 资源管理
4. ✅ 用户账户元素
5. ✅ 会话控制（"新会话"按钮等）
6. ✅ 反馈机制
7. ✅ 外部导航

### 保留的元素

- ✅ 搜索框（输入播客 URL）
- ✅ 处理状态显示
- ✅ 结果展示（摘要、大纲）
- ✅ 错误提示

### UI 风格

- 与 MuleRun 本体风格保持一致
- 适配 iframe 环境（小窗口）
- 简洁、专注

---

## 🔄 业务流程（严格按照文档）

### 1. 会话启动流程

```
用户点击 MuleRun Agent
    ↓
MuleRun 平台打开 Start Session URL
    ↓
URL 参数：userId, sessionId, agentId, time, origin, nonce, signature
    ↓
验证签名（HMAC SHA-256）
    ↓
创建/恢复 MulerunSession
    ↓
显示处理界面
```

### 2. 播客处理流程

```
用户输入播客 URL
    ↓
创建 MulerunQueryHistory（status: pending）
    ↓
提交到 TaskQueue 处理
    ↓
处理中（status: processing）
    ↓
处理成功
    ↓
报告成本到 Metering API（100 credits）
    ↓
更新状态（status: completed）
    ↓
显示结果
```

### 3. 超时处理流程

```
查询创建时间 + 3 小时
    ↓
检查状态（如果仍在 processing）
    ↓
标记为 timeout
    ↓
发送 final Metering 报告（0 credits，表示失败）
    ↓
更新会话状态（如果所有查询都完成）
```

---

## 🛠️ 实现步骤

### 阶段1：基础框架（不影响现有服务）

1. ✅ 创建 `/mulerun/session` 路由
2. ✅ 实现签名验证函数（严格按照文档）
3. ✅ 创建会话管理函数
4. ✅ 基础 UI（iframe 适配）

### 阶段2：核心功能

1. ✅ 播客处理集成（复用现有逻辑）
2. ✅ Metering API 集成（严格按照文档）
3. ✅ 超时检测和处理

### 阶段3：完善和优化

1. ✅ UI 优化（MuleRun 风格）
2. ✅ 错误处理完善
3. ✅ 性能优化

---

## 🔒 安全考虑（严格按照文档）

### 签名验证

- ✅ 必须验证每个请求的签名
- ✅ 验证时间戳（防止重放攻击）
- ✅ Agent Key 不能暴露给前端

### HTTP Headers（已实现）

- ✅ `X-Frame-Options: ALLOW-FROM https://mulerun.com`
- ✅ `Content-Security-Policy: frame-ancestors 'self' https://mulerun.com;`

---

## 📝 环境变量配置

```bash
# MuleRun 配置
MULERUN_AGENT_KEY=mck-xxx  # Agent Key（用于签名和 Metering API）
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100  # 每次查询成本（credits）
MULERUN_SESSION_TIMEOUT_MINUTES=180  # 会话超时（3 小时）
```

---

## 🧪 测试计划

### 1. 本地测试

- ✅ 签名验证测试
- ✅ Metering API 测试（使用 Test Agent）
- ✅ UI 适配测试

### 2. MuleRun Test Agent 测试

- ✅ 使用 Test Agent URL
- ✅ 使用 Test Credentials
- ✅ 验证完整流程

### 3. 生产环境测试

- ✅ 小流量测试
- ✅ 监控 Metering 报告
- ✅ 验证计费正确性

---

## ⚠️ 风险控制

### 隔离性

- ✅ 独立路由 `/mulerun/*`
- ✅ 不影响 Product A 的任何功能
- ✅ 可以随时禁用（删除路由或返回 404）

### 回滚方案

1. 在 MuleRun 平台禁用 Agent
2. 代码回退到稳定版本
3. 删除 `/mulerun/*` 路由

---

## 📋 后续优化

1. **成本调整**：通过环境变量 `MULERUN_QUERY_COST_CREDITS` 调整
2. **Share Session URL**：如果需要，后续实现
3. **性能优化**：根据实际使用情况优化
