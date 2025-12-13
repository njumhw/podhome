# MuleRun 签名验证问题排查

## 问题：Invalid signature

### 诊断步骤

#### 1. 查看服务器日志

```bash
# 查看最近的 MuleRun 日志
pm2 logs podroom --lines 200 | grep -i mulerun

# 或者查看所有日志
pm2 logs podroom --lines 200
```

#### 2. 检查环境变量

```bash
# 确认 Agent Key 已加载
pm2 env 0 | grep MULERUN_AGENT_KEY

# 应该能看到类似：
# MULERUN_AGENT_KEY: mck-xxxxxxxxxxxxxxxxxxxxx
```

#### 3. 检查 Agent Key 是否匹配

**重要**：服务器上的 `MULERUN_AGENT_KEY` 必须与 MuleRun Creator Studio 中的 Agent Key **完全一致**。

```bash
# 在服务器上查看
pm2 env 0 | grep MULERUN_AGENT_KEY

# 在 MuleRun Creator Studio 中查看
# "3 Set Up Credentials" 步骤中的 Agent Key
```

**如果不同，需要更新：**

```bash
# 1. 编辑 .env 文件
cd /opt/podroom
nano .env

# 2. 更新 MULERUN_AGENT_KEY（不要加引号）
MULERUN_AGENT_KEY=mck-新的key值

# 3. 保存并退出

# 4. 重启应用
pm2 restart podroom

# 5. 验证
pm2 env 0 | grep MULERUN_AGENT_KEY
```

#### 4. 检查服务器时间

签名验证允许 5 分钟的时间差，如果服务器时间偏差太大，会导致验证失败。

```bash
# 检查服务器时间
date

# 如果时间不对，同步时间
sudo ntpdate -s time.nist.gov
# 或者
sudo timedatectl set-ntp true
```

#### 5. 查看详细日志

日志会显示：
- 接收到的参数
- 计算出的签名
- 期望的签名
- Agent Key 的前缀

```bash
pm2 logs podroom --lines 100 | grep -A 10 "签名验证"
```

### 常见原因

1. **Agent Key 不匹配**（最常见）
   - 服务器上的 Agent Key 与 MuleRun Creator Studio 中的不一致
   - 解决：更新 `.env` 文件并重启应用

2. **环境变量未加载**
   - PM2 没有正确加载 `.env` 文件
   - 解决：使用 `ecosystem.config.js` 启动应用

3. **服务器时间不同步**
   - 服务器时间与 MuleRun 服务器时间偏差超过 5 分钟
   - 解决：同步服务器时间

4. **参数编码问题**
   - URL 参数编码/解码问题
   - 解决：检查日志中的参数值

### 验证修复

修复后，在 MuleRun Creator Studio 中点击 **"TEST AND PREVIEW"**，应该能看到：
- 正常的 MuleRun 界面（无 Header/Footer）
- 日志显示 "签名验证成功"

