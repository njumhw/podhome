# MuleRun 签名验证失败修复

## 问题分析

从日志中可以看到：
- 签名验证失败
- 参数格式看起来正确（agentId, nonce, origin, sessionId, time, userId）
- 但缺少详细的签名对比信息

## 诊断步骤

### 1. 查看完整的签名验证日志

```bash
# 查看包含 expected 和 received 签名的完整日志
pm2 logs podroom --lines 300 | grep -A 15 "签名验证失败"

# 或者查看所有 MuleRun 相关日志
pm2 logs podroom --lines 300 | grep -i mulerun
```

### 2. 检查 Agent Key 是否匹配

**关键**：服务器上的 Agent Key 必须与 MuleRun Creator Studio 中的完全一致。

```bash
# 在服务器上查看
pm2 env 0 | grep MULERUN_AGENT_KEY

# 应该看到类似：
# MULERUN_AGENT_KEY: mck-xxxxxxxxxxxxxxxxxxxxx
```

**在 MuleRun Creator Studio 中查看：**
1. 进入 "3 Set Up Credentials" 步骤
2. 复制 Agent Key（通常以 `mck-` 开头）

**对比两者是否完全一致**（包括大小写、所有字符）

### 3. 如果 Agent Key 不匹配，更新它

```bash
# 1. 编辑 .env 文件
cd /opt/podroom
nano .env

# 2. 找到 MULERUN_AGENT_KEY 行
# 3. 更新为 MuleRun Creator Studio 中的值（不要加引号）
MULERUN_AGENT_KEY=mck-从MuleRun复制的完整key值

# 4. 保存并退出（Ctrl+X, Y, Enter）

# 5. 重启应用
pm2 restart podroom

# 6. 验证环境变量
pm2 env 0 | grep MULERUN_AGENT_KEY
```

### 4. 检查服务器时间

```bash
# 检查服务器时间
date

# 如果时间不对，同步时间
sudo ntpdate -s time.nist.gov
# 或者
sudo timedatectl set-ntp true
```

### 5. 查看详细签名对比

日志应该显示：
- `expected`: 计算出的签名
- `received`: 接收到的签名
- `jsonString`: 用于计算签名的 JSON 字符串
- `agentKeyPrefix`: Agent Key 的前缀

如果这些信息不完整，说明日志输出有问题。

## 可能的原因

1. **Agent Key 不匹配**（最常见）
   - 服务器上的 Agent Key 与 MuleRun Creator Studio 中的不一致
   - 解决：更新 `.env` 文件并重启

2. **Agent Key 格式问题**
   - 包含多余的空格或引号
   - 解决：确保 `.env` 文件中没有引号，没有前后空格

3. **服务器时间不同步**
   - 时间戳验证失败
   - 解决：同步服务器时间

4. **参数顺序问题**
   - JSON 序列化顺序不对
   - 解决：检查代码中的排序逻辑

## 验证修复

修复后，在 MuleRun Creator Studio 中点击 **"TEST AND PREVIEW"**，然后查看日志：

```bash
pm2 logs podroom --lines 50 | grep -i "签名验证"
```

应该看到：
- `[MuleRun] 签名验证成功`
- 而不是 `[MuleRun] 签名验证失败`

