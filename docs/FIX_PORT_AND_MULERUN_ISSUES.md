# 修复端口冲突和 MuleRun 详情页问题

## 问题 1：端口冲突（EADDRINUSE: address already in use :::3005）

### 解决步骤

```bash
# 1. 停止所有 PM2 进程
pm2 stop all
pm2 delete all

# 2. 停止所有占用 3005 端口的进程
lsof -i :3005 | grep LISTEN | awk '{print $2}' | xargs kill -9

# 3. 停止所有 next start 和 node 进程
pkill -f "next start"
pkill -f "node.*next"

# 4. 等待 2 秒让端口完全释放
sleep 2

# 5. 确认端口已释放
lsof -i :3005

# 应该没有输出

# 6. 检查是否还有其他 Node.js 进程
ps aux | grep node | grep -v grep

# 7. 重新启动应用（使用 ecosystem.config.js）
cd /opt/podroom
pm2 start ecosystem.config.js --env production

# 8. 验证
pm2 list
pm2 logs podroom --lines 20
```

## 问题 2：MuleRun 详情页显示"播客不存在"

### 可能的原因

1. **前端代码未更新**：服务器上的代码可能还是旧版本
2. **浏览器缓存**：浏览器可能缓存了旧的 JavaScript
3. **API 返回格式问题**：需要检查实际返回的数据

### 诊断步骤

```bash
# 1. 确认代码已更新
cd /opt/podroom
git log --oneline -5

# 应该看到最新的提交（包含 "修复 MuleRun 详情页"）

# 2. 检查构建是否成功
ls -la .next/

# 3. 查看浏览器控制台错误
# 在 MuleRun 详情页按 F12，查看 Console 标签页的错误信息

# 4. 测试 API 直接返回
curl "https://podcasttoinsight.top/api/public/podcast?id=YOUR_PODCAST_ID&_mulerun=true" | jq .

# 检查返回的数据格式是否正确
```

### 修复步骤

如果代码已更新但问题仍然存在：

```bash
# 1. 重新构建应用
cd /opt/podroom
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 2. 重启应用
pm2 restart podroom

# 3. 清除浏览器缓存
# 在浏览器中按 Ctrl+Shift+Delete，清除缓存
# 或者使用无痕模式测试
```

