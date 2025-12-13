# MuleRun 集成 - 下一步操作指南

## 当前状态

✅ 代码已部署到服务器  
✅ 环境变量已正确加载（`MULERUN_AGENT_KEY`）  
✅ 应用正常运行（PM2 管理）  
✅ MuleRun UI 已修复（移除 Header/Footer，专用 layout）  
✅ 签名验证已增强（详细日志）

## 下一步操作

### 步骤 1: 验证服务器端配置

在服务器上执行以下命令，确认一切就绪：

```bash
# 1. 检查环境变量
pm2 env 0 | grep MULERUN_AGENT_KEY
# 应该能看到 MULERUN_AGENT_KEY 的值

# 2. 检查应用状态
pm2 list
# 应该看到 podroom 进程状态为 "online"

# 3. 检查端口监听
netstat -tlnp | grep :3005
# 应该看到 next-server 进程在监听 3005

# 4. 检查 HTTPS 配置
curl -I https://podcasttoinsight.top/mulerun/session
# 应该返回 400 Bad Request（缺少参数是正常的，说明路由正常）

# 5. 查看日志，确认 MuleRun 模块已加载
pm2 logs podroom --lines 50 | grep -i mulerun
# 应该看到 MuleRun 相关的日志
```

### 步骤 2: 在 MuleRun Creator Studio 中配置 Agent

#### 2.1 基本信息配置

在 MuleRun Creator Studio 的 "Create Your Agent" 页面填写：

| 字段 | 填写内容 | 说明 |
|------|---------|------|
| **Agent Name** | `Podcast to Insight` | Agent 名称 |
| **Import Workflow** | `Iframe` | 选择 Iframe 工作流 |
| **Start Session URL** | `https://podcasttoinsight.top/mulerun/session` | 必需，必须以 https:// 开头 |
| **Share Session URL** | `https://podcasttoinsight.top/mulerun/session?sessionId={sessionId}` | 会话分享 URL |
| **Max Age** | `180` | 单位：Minutes（3 小时 = 180 分钟） |
| **Start Session Refresh Interval** | `60` | 单位：Minutes（1 分钟刷新一次） |
| **Full Screen** | `关闭（off）` | 可选，根据需求 |

#### 2.2 Agent 描述配置

参考 `docs/MULERUN_AGENT_DESCRIPTION.md` 填写：
- **Overview**（一句话总结，70字符以内）
- **Description**（50-150字）
- **Product Advantages**（3-5个优势）
- **Key Messages**（价值主张）

#### 2.3 计费方式配置

选择 **"Creator Metering"**：
- 我们使用 Metering API 动态报告成本
- 每次查询固定 100 credits（0.01）
- 通过 Metering API 报告使用成本

#### 2.4 获取 Agent Key

1. 完成 "Create Your Agent" 步骤
2. 进入 **"3 Set Up Credentials"** 步骤
3. 复制 **Agent Key**（通常以 `mck-` 开头）
4. **重要**：如果 Agent Key 与服务器上的不同，需要更新服务器配置

### 步骤 3: 更新服务器 Agent Key（如果需要）

如果 MuleRun Creator Studio 中的 Agent Key 与服务器上的不同：

```bash
# 1. 编辑 .env 文件
cd /opt/podroom
nano .env

# 2. 更新 MULERUN_AGENT_KEY
# 找到 MULERUN_AGENT_KEY=xxx
# 替换为新的 Agent Key（不要加引号）

# 3. 保存并退出（Ctrl+X, Y, Enter）

# 4. 重启应用
pm2 restart podroom

# 5. 验证环境变量
pm2 env 0 | grep MULERUN_AGENT_KEY
```

### 步骤 4: 测试 MuleRun 集成

#### 4.1 在 MuleRun Creator Studio 中测试

1. 点击 **"TEST AND PREVIEW"** 按钮
2. 应该能看到 MuleRun 界面：
   - 搜索框
   - 三个示例播客卡片
   - 无 Header/Footer（干净的界面）

#### 4.2 检查服务器日志

```bash
# 实时查看日志
pm2 logs podroom --lines 100 | grep -i mulerun

# 应该看到：
# - [MuleRun] 签名验证成功
# - [MuleRun] 创建会话成功
# - [MuleRun] Metering 报告成功
```

#### 4.3 测试播客处理

1. 在 MuleRun 界面输入一个播客 URL
2. 提交处理请求
3. 观察处理状态
4. 检查日志确认处理流程正常

### 步骤 5: 提交审核

如果测试通过：

1. 在 MuleRun Creator Studio 中点击 **"SUBMIT TO MULERUN"**
2. 完成身份验证（如果提示）
3. 等待审核结果

## 验证清单

在提交审核前，请确认：

- [ ] 服务器环境变量已正确加载（`pm2 env 0 | grep MULERUN_AGENT_KEY`）
- [ ] HTTPS 配置正确（`curl -I https://podcasttoinsight.top/mulerun/session`）
- [ ] MuleRun 界面正常显示（无 Header/Footer，只有搜索框和示例播客）
- [ ] 签名验证正常（日志显示"签名验证成功"）
- [ ] 播客处理功能正常（可以提交和处理播客）
- [ ] Metering API 正常（日志显示"Metering 报告成功"）
- [ ] Agent Key 与 MuleRun Creator Studio 中的一致

## 常见问题

### 问题 1: 签名验证失败

**检查：**
```bash
# 1. 确认 Agent Key 正确
pm2 env 0 | grep MULERUN_AGENT_KEY

# 2. 查看详细日志
pm2 logs podroom --lines 100 | grep -i "签名验证"

# 3. 检查服务器时间
date
# 确保服务器时间正确（签名验证允许 5 分钟时间差）
```

**解决：**
- 确认 Agent Key 与 MuleRun Creator Studio 中的一致
- 如果 Agent Key 不同，更新 `.env` 文件并重启应用

### 问题 2: MuleRun 界面显示 Header/Footer

**检查：**
- 确认代码已更新（`git pull origin main`）
- 确认应用已重启（`pm2 restart podroom`）
- 检查 `src/app/mulerun/layout.tsx` 是否存在

### 问题 3: 播客处理失败

**检查：**
```bash
# 查看处理日志
pm2 logs podroom --lines 100 | grep -i "处理\|error\|失败"
```

**可能原因：**
- OSS 配置问题
- ASR API 配置问题
- 数据库连接问题

## 需要帮助？

如果遇到问题，请提供：
1. 服务器日志（`pm2 logs podroom --lines 200`）
2. MuleRun Creator Studio 中的错误信息
3. 具体的操作步骤和错误现象

