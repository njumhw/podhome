# 端口清理后的部署步骤

## 当前状态
- ✅ PM2 进程已停止和删除
- ✅ 端口 3005 已释放（`lsof -i :3005` 无输出）
- ✅ 残留的 node 进程只是系统监控（watcher.js），不影响

## 部署步骤

### 1. 拉取最新代码

```bash
cd /opt/podroom
git pull origin main
```

### 2. 检查是否需要重新构建

```bash
# 检查 .next 目录是否存在且是最新的
ls -la .next/

# 如果不存在或需要更新，执行构建
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

### 3. 确认 ecosystem.config.js 存在

```bash
ls -la ecosystem.config.js
cat ecosystem.config.js | head -20
```

### 4. 使用 ecosystem.config.js 启动应用

```bash
# 使用 ecosystem.config.js 启动（会自动加载 .env 文件中的环境变量）
pm2 start ecosystem.config.js --env production

# 或者如果已经存在配置，使用：
pm2 start ecosystem.config.js
```

### 5. 保存 PM2 配置

```bash
pm2 save
```

### 6. 验证部署

```bash
# 查看进程状态
pm2 list

# 查看日志（确认没有端口冲突错误）
pm2 logs podroom --lines 30

# 验证环境变量（特别是 MULERUN_AGENT_KEY）
pm2 env 0 | grep MULERUN_AGENT_KEY

# 检查端口是否被正确监听
netstat -tlnp | grep :3005
# 或
lsof -i :3005 | grep LISTEN
```

### 7. 如果启动失败

如果 `pm2 start` 仍然报端口冲突：

```bash
# 再次检查端口
netstat -tlnp | grep :3005
ss -tlnp | grep :3005

# 如果有输出，找到 PID 并 kill
# 然后等待 2 秒
sleep 2

# 再次启动
pm2 start ecosystem.config.js --env production
```

## 验证 MuleRun 详情页

部署成功后：

1. **清除浏览器缓存**（重要！）
   - 按 `Ctrl+Shift+Delete` 或使用无痕模式

2. **打开浏览器控制台**（F12）
   - 访问 MuleRun 详情页
   - 查看 Console 标签页的日志输出

3. **检查日志**
   - 应该看到 `[MuleRun] 开始获取播客`
   - 应该看到 `[MuleRun] API 返回数据`
   - 如果看到错误，告诉我具体的错误信息

