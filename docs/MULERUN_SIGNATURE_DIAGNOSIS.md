# MuleRun 签名验证诊断步骤

## 问题现象
签名验证失败，`expected` 和 `received` 签名完全不同。

## 诊断步骤

### 1. 检查 Agent Key 是否有隐藏字符

```bash
# 在服务器上执行
cd /opt/podroom

# 检查 .env 文件中的 Agent Key（查看原始值，包括可能的引号、空格等）
cat .env | grep MULERUN_AGENT_KEY | od -c

# 检查 PM2 环境变量中的 Agent Key
pm2 env 0 | grep MULERUN_AGENT_KEY | od -c

# 对比两个值是否完全一致（包括隐藏字符）
```

### 2. 运行测试脚本

```bash
# 在服务器上执行
cd /opt/podroom

# 运行测试脚本（需要先设置 Agent Key）
MULERUN_AGENT_KEY="mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO" npx tsx scripts/test-mulerun-signature.ts
```

### 3. 检查 Agent Key 的 trim 处理

如果 `.env` 文件中的 Agent Key 有引号或空格，需要确保代码正确处理。

**当前代码行为：**
- `ecosystem.config.js` 会移除引号：`.replace(/^["']|["']$/g, '')`
- 但 `process.env.MULERUN_AGENT_KEY` 可能仍然包含引号或空格

**解决方案：**
在 `src/app/api/mulerun/session/route.ts` 和 `src/server/mulerun/signature.ts` 中添加 trim 处理：

```typescript
// 确保 Agent Key 没有隐藏字符
const cleanAgentKey = agentKey.trim().replace(/^["']|["']$/g, '');
```

### 4. 验证签名计算

使用 Python 脚本验证签名计算是否正确（参考 MuleRun 文档的 Python 示例）：

```python
import json
import hmac
import hashlib
from urllib.parse import unquote

# 参数（从日志中提取）
params = {
    'agentId': '6fdfb3b1-b048-4b13-9127-4f42b0a878ae',
    'nonce': 'f0dae613-1994-41fd-a6f2-1cfba668bb9f',
    'origin': 'mulerun.com',
    'sessionId': 'dddf0111-f22b-462c-90c9-97440bff8236',
    'time': '1765631830',
    'userId': '84a312a3ad89d1d4fe721a9af6ebcc8481a0119a450fb437c22355dbb08c06b9',
}

# Agent Key
agent_key = 'mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO'

# 按 key 排序
sorted_params = dict(sorted(params.items()))

# 序列化为 JSON
json_string = json.dumps(sorted_params, separators=(',', ':'), sort_keys=True)

# 计算 HMAC SHA-256
signature = hmac.new(
    agent_key.encode('utf-8'),
    json_string.encode('utf-8'),
    hashlib.sha256
).hexdigest()

print(f'JSON String: {json_string}')
print(f'Signature: {signature}')
print(f'Expected (from logs): ba3f26d8f4265ce3614e8b5615d7e21c0b86b5aee5399e75fa744e6270de1300')
print(f'Received (from logs): 1f06299971be7909256624b34c0415df4e7a1dc9add5cddb2f39f0586ac10a18')
```

## 可能的原因

1. **Agent Key 有隐藏字符**：`.env` 文件中的值可能有引号、空格或换行符
2. **参数值编码问题**：虽然已经 URL 解码，但可能还有其他编码问题
3. **JSON 序列化格式**：虽然使用了 `JSON.stringify`，但可能格式不完全匹配 Python 的 `json.dumps(..., separators=(',', ':'), sort_keys=True)`

## 解决方案

### 方案 1：确保 Agent Key 没有隐藏字符

在代码中添加 trim 和清理处理：

```typescript
// src/app/api/mulerun/session/route.ts
let agentKey = MULERUN_AGENT_KEY?.trim().replace(/^["']|["']$/g, '') || '';

// src/server/mulerun/signature.ts
export function verifyMulerunSignature(
  params: Record<string, string>,
  agentKey: string
): boolean {
  // 清理 Agent Key
  const cleanAgentKey = agentKey.trim().replace(/^["']|["']$/g, '');
  // ... 使用 cleanAgentKey 而不是 agentKey
}
```

### 方案 2：检查 .env 文件格式

确保 `.env` 文件中的 Agent Key 没有引号，没有首尾空格：

```bash
# 正确的格式
MULERUN_AGENT_KEY=mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO

# 错误的格式（不要这样）
MULERUN_AGENT_KEY="mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO"
MULERUN_AGENT_KEY= mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO 
```

