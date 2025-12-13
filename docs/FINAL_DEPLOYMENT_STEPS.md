# MuleRun 集成最终部署步骤

## ✅ 已完成的工作

1. ✅ MuleRun Iframe Agent 完整实现
2. ✅ 签名验证模块
3. ✅ Metering API 集成
4. ✅ 会话管理和查询历史
5. ✅ 超时检测器
6. ✅ 前端 UI 页面（MuleRun 风格）
7. ✅ 示例播客功能
8. ✅ 本地测试和预览

## 📋 服务器部署步骤

### 步骤 1: 连接服务器并进入项目目录

```bash
ssh root@your-server-ip
cd /opt/podroom
```

### 步骤 2: 停止当前应用

```bash
pm2 stop podroom
# 或者查看所有进程
pm2 list
```

### 步骤 3: 拉取最新代码

```bash
git pull origin main
```

### 步骤 4: 安装依赖（如果有新依赖）

```bash
pnpm install --frozen-lockfile
```

### 步骤 5: 生成 Prisma Client

```bash
npx prisma generate
```

### 步骤 6: 运行数据库迁移（同步 schema）

```bash
# 使用 db push 同步 schema（适合已有数据库）
npx prisma db push
```

**注意**：如果 `db push` 失败，参考 `docs/DATABASE_MIGRATION_FIX.md`

### 步骤 7: 配置环境变量

```bash
# 编辑 .env 文件
nano .env
```

确保包含以下 MuleRun 配置：

```env
# MuleRun 配置
MULERUN_AGENT_KEY=mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVI0
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100
MULERUN_SESSION_TIMEOUT_MINUTES=180
```

保存文件：`Ctrl+O` → `Enter` → `Ctrl+X`

### 步骤 8: 构建应用

```bash
# 使用限制内存的方式构建（避免 OOM）
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

### 步骤 9: 启动应用（生产模式）

```bash
# 使用生产模式启动
PORT=3005 pm2 start npm --name podroom -- start

# 保存 PM2 配置
pm2 save
```

### 步骤 10: 检查应用状态

```bash
# 查看 PM2 进程状态
pm2 list

# 查看日志（确认没有错误）
pm2 logs podroom --lines 50

# 检查环境变量是否加载
pm2 env podroom | grep MULERUN
```

**预期输出**：
- `pm2 list` 应该显示 `podroom` 进程状态为 `online`
- `pm2 logs` 应该看到：
  - `🚀 初始化应用...`
  - `✅ 应用初始化完成`
  - `[MuleRun] 启动超时检测器（每 5 分钟检查一次）`

### 步骤 11: 验证 HTTPS 和路由

```bash
# 检查 HTTPS 证书
sudo certbot certificates

# 检查 Nginx 配置
sudo nginx -t

# 测试 HTTPS 路由（应该返回 400，因为缺少参数，但说明路由存在）
curl -I "https://podcasttoinsight.top/mulerun/session"
```

**预期结果**：
- 应该返回 `400 Bad Request`（缺少参数是正常的，说明路由存在）

### 步骤 12: 验证域名解析

```bash
# 检查域名是否指向服务器 IP
nslookup podcasttoinsight.top
```

## 🎯 MuleRun Creator Studio 配置

在 MuleRun Creator Studio 中配置 Agent：

### 基本配置

| 字段 | 填写内容 |
|------|---------|
| **Agent Name** | `Podcast to Insight` |
| **Import Workflow** | `Iframe` |
| **Start Session URL** | `https://podcasttoinsight.top/mulerun/session` |
| **Share Session URL** | `https://podcasttoinsight.top/mulerun/session` |
| **Max Age** | `180` (Minutes) |
| **Start Session Refresh Interval** | `0` (Minutes) |
| **Full Screen** | `关闭（off）` |

### 获取 Agent Key

1. 在 MuleRun Creator Studio 中创建 Agent 后
2. 进入 **"3 Set Up Credentials"** 步骤
3. 复制 **Agent Key**（通常以 `mck-` 开头）
4. 确保服务器 `.env` 文件中的 `MULERUN_AGENT_KEY` 与此一致

## ✅ 验证清单

完成部署后，确认：

- [ ] 代码已拉取到服务器
- [ ] 依赖已安装
- [ ] Prisma Client 已生成
- [ ] 数据库 schema 已同步（`MulerunSession` 和 `MulerunQueryHistory` 表已创建）
- [ ] 环境变量已配置（包括 `MULERUN_AGENT_KEY`）
- [ ] 应用已构建成功
- [ ] PM2 进程状态为 `online`
- [ ] 应用日志无严重错误
- [ ] HTTPS 证书有效
- [ ] Nginx 配置正确
- [ ] `/mulerun/session` 路由可访问（返回 400/401 是正常的）
- [ ] MuleRun Creator Studio 配置完成
- [ ] Agent Key 已配置并验证

## 🧪 测试步骤

### 1. 在 MuleRun Creator Studio 中测试

1. 完成 Agent 配置
2. 点击 **"CREATE & NEXT"** 完成所有步骤
3. 在 MuleRun 平台测试 Agent
4. 提交一个播客 URL 进行测试

### 2. 检查服务器日志

```bash
# 查看 MuleRun 相关日志
pm2 logs podroom | grep -i mulerun

# 应该看到：
# [MuleRun] 签名验证成功
# [MuleRun] 创建会话成功
# [MuleRun] Metering 报告成功
```

### 3. 检查数据库

```bash
# 检查会话是否创建
# 可以使用 Prisma Studio 或直接查询数据库
npx prisma studio
```

## 🚨 常见问题排查

### 问题 1: 数据库迁移失败

**解决方案**：
```bash
# 使用 db push 而不是 migrate deploy
npx prisma db push
```

### 问题 2: Agent Key 错误

**检查**：
```bash
pm2 env podroom | grep MULERUN_AGENT_KEY
```

**解决**：确保 `.env` 文件中的值正确，然后重启应用

### 问题 3: 签名验证失败

**检查日志**：
```bash
pm2 logs podroom | grep "签名验证失败"
```

**可能原因**：
1. Agent Key 配置错误
2. 服务器时间不同步（检查 `date` 命令）
3. URL 参数编码问题

### 问题 4: HTTPS 证书问题

**解决方案**：
```bash
sudo certbot renew
sudo systemctl reload nginx
```

## 📞 需要帮助？

如果遇到问题，请提供：
1. `pm2 logs podroom --lines 100` 的输出
2. `pm2 env podroom | grep MULERUN` 的输出
3. `curl -I https://podcasttoinsight.top/mulerun/session` 的输出
4. 具体的错误信息

