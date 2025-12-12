# 服务器预部署步骤（MuleRun 集成前）

## 目标
在配置 MuleRun Agent Key 之前，确保：
1. ✅ 代码已部署到服务器
2. ✅ 数据库迁移已完成
3. ✅ 环境变量已配置（除 Agent Key 外）
4. ✅ HTTPS 配置正确
5. ✅ `/mulerun/session` 路由可以正常访问

---

## 步骤 1: 连接服务器并进入项目目录

```bash
ssh root@your-server-ip
cd /opt/podroom
```

---

## 步骤 2: 停止当前应用

```bash
pm2 stop podroom
# 或者如果应用名称不同，先查看
pm2 list
```

---

## 步骤 3: 拉取最新代码

```bash
# 确保在正确的分支
git fetch origin
git pull origin main

# 检查是否有新文件
git status
```

---

## 步骤 4: 安装依赖（如果有新依赖）

```bash
pnpm install --frozen-lockfile
```

---

## 步骤 5: 生成 Prisma Client

```bash
npx prisma generate
```

---

## 步骤 6: 运行数据库迁移

```bash
# 检查是否有待迁移的变更
npx prisma migrate status

# 如果有待迁移的变更，执行迁移
npx prisma migrate deploy
```

---

## 步骤 7: 配置环境变量（除 Agent Key 外）

```bash
# 编辑 .env 文件
nano .env
```

添加以下配置（**暂时不填 Agent Key**）：

```env
# MuleRun 配置（Agent Key 稍后从 MuleRun Creator Studio 获取）
# MULERUN_AGENT_KEY=  # 暂时留空，稍后填写
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100
MULERUN_SESSION_TIMEOUT_MINUTES=180
```

**注意**：如果 `.env` 文件中已经有其他配置（如数据库、OSS 等），不要删除，只添加上述 MuleRun 配置。

保存文件：`Ctrl+O` → `Enter` → `Ctrl+X`

---

## 步骤 8: 构建应用

```bash
# 使用限制内存的方式构建（避免 OOM）
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

如果构建成功，会看到：
```
✓ Compiled successfully
```

---

## 步骤 9: 启动应用

```bash
# 使用生产模式启动
PORT=3005 pm2 start npm --name podroom -- start

# 或者如果之前用的是 dev 模式，现在切换到生产模式
pm2 delete podroom  # 先删除旧进程
PORT=3005 pm2 start npm --name podroom -- start

# 保存 PM2 配置
pm2 save
```

---

## 步骤 10: 检查应用状态

```bash
# 查看 PM2 进程状态
pm2 list

# 查看日志（确认没有错误）
pm2 logs podroom --lines 50

# 检查环境变量是否加载（应该看到 MULERUN_API_BASE_URL 等，但 MULERUN_AGENT_KEY 可能为空）
pm2 env podroom | grep MULERUN
```

**预期输出**：
- `pm2 list` 应该显示 `podroom` 进程状态为 `online`
- `pm2 logs` 应该看到应用启动日志，包括：
  - `🚀 初始化应用...`
  - `✅ 应用初始化完成`
  - `[MuleRun] 启动超时检测器（每 5 分钟检查一次）`（如果 Agent Key 未配置，可能会有警告）

---

## 步骤 11: 检查 HTTPS 配置

```bash
# 检查 SSL 证书
sudo certbot certificates

# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 配置中的域名
sudo cat /etc/nginx/sites-available/podroom | grep server_name
```

**预期结果**：
- `certbot certificates` 应该显示 `podcasttoinsight.top` 的证书，且 `Expiry Date` 未过期
- `nginx -t` 应该显示 `syntax is ok` 和 `test is successful`
- `server_name` 应该包含 `podcasttoinsight.top`

---

## 步骤 12: 测试本地端口（3005）

```bash
# 测试应用是否在 3005 端口运行
curl -I http://localhost:3005

# 测试 MuleRun 路由（应该返回 400 或 401，因为缺少参数，但说明路由存在）
curl -I http://localhost:3005/mulerun/session
```

**预期结果**：
- 应该返回 `HTTP/1.1 200 OK` 或 `400 Bad Request`（缺少参数是正常的）

---

## 步骤 13: 测试 HTTPS 访问

```bash
# 测试 HTTPS 主页
curl -I https://podcasttoinsight.top

# 测试 MuleRun 路由（应该返回 400，因为缺少必需参数）
curl -I "https://podcasttoinsight.top/mulerun/session"

# 测试带参数的请求（应该返回 401，因为 Agent Key 未配置或签名验证失败）
curl -I "https://podcasttoinsight.top/mulerun/session?userId=test&sessionId=test&agentId=test&time=1234567890&origin=https://mulerun.com&nonce=test&signature=test"
```

**预期结果**：
- HTTPS 主页应该返回 `200 OK`
- `/mulerun/session` 路由应该返回 `400 Bad Request`（缺少参数）或 `401 Unauthorized`（签名验证失败）
- **重要**：如果返回 `404 Not Found`，说明路由未正确部署

---

## 步骤 14: 检查防火墙和安全组

### 服务器防火墙

```bash
# 检查防火墙状态
sudo ufw status

# 如果 443 端口未开放，添加规则
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp  # HTTP 用于证书申请
```

### 阿里云安全组

在阿里云控制台：
1. 进入 **ECS 实例** → 选择你的实例
2. 点击 **安全组** → **配置规则**
3. 确保有以下入站规则：
   - **端口 443**，协议 **TCP**，源 **0.0.0.0/0**
   - **端口 80**，协议 **TCP**，源 **0.0.0.0/0**（用于证书申请）

---

## 步骤 15: 验证域名解析

```bash
# 检查域名是否指向服务器 IP
nslookup podcasttoinsight.top
dig podcasttoinsight.top +short
```

**预期结果**：
- 应该返回你的服务器 IP 地址

---

## 步骤 16: 浏览器测试

在浏览器中访问：

1. **主页**：`https://podcasttoinsight.top`
   - 应该正常显示（可能需要登录）

2. **MuleRun 路由**：`https://podcasttoinsight.top/mulerun/session`
   - 应该显示错误页面或加载中（因为缺少必需参数）
   - **重要**：如果显示 `404 Not Found`，说明路由未正确部署

---

## ✅ 验证清单

完成以上步骤后，确认：

- [ ] 代码已拉取到服务器
- [ ] 依赖已安装
- [ ] Prisma Client 已生成
- [ ] 数据库迁移已完成
- [ ] 环境变量已配置（除 Agent Key 外）
- [ ] 应用已构建成功
- [ ] PM2 进程状态为 `online`
- [ ] 应用日志无严重错误
- [ ] SSL 证书有效
- [ ] Nginx 配置正确
- [ ] 本地端口 3005 可访问
- [ ] HTTPS 主页可访问
- [ ] `/mulerun/session` 路由可访问（返回 400/401 是正常的）
- [ ] 防火墙允许 443 端口
- [ ] 阿里云安全组允许 443 端口
- [ ] 域名解析正确

---

## 🚨 常见问题

### 问题 1: 构建失败（OOM）

**解决方案**：
```bash
# 增加 swap 空间或使用更小的内存限制
NODE_OPTIONS='--max-old-space-size=1024' pnpm build
```

### 问题 2: PM2 启动失败

**检查**：
```bash
pm2 logs podroom --lines 100
```

**可能原因**：
- 端口被占用：`sudo lsof -i :3005`
- 环境变量错误：检查 `.env` 文件格式
- 构建失败：检查 `.next` 目录是否存在

### 问题 3: HTTPS 证书过期

**解决方案**：
```bash
sudo certbot renew
sudo systemctl reload nginx
```

### 问题 4: 路由 404

**检查**：
```bash
# 确认构建成功
ls -la .next/

# 检查路由文件是否存在
ls -la src/app/mulerun/session/
```

---

## 📝 下一步

完成以上所有步骤后，你可以：

1. 在 MuleRun Creator Studio 中创建 Agent
2. 获取 Agent Key
3. 在服务器 `.env` 文件中添加 `MULERUN_AGENT_KEY`
4. 重启应用：`pm2 restart podroom`
5. 在 MuleRun 平台测试 Agent

---

## 📞 需要帮助？

如果遇到问题，请提供：
1. `pm2 logs podroom --lines 100` 的输出
2. `sudo nginx -t` 的输出
3. `curl -I https://podcasttoinsight.top/mulerun/session` 的输出

