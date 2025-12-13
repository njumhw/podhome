# 验证部署步骤

## 方法 1: 安装 curl 并测试

```bash
# 安装 curl
sudo apt install curl -y

# 测试 HTTPS 路由（应该返回 400，因为缺少参数，但说明路由存在）
curl -I "https://podcasttoinsight.top/mulerun/session"
```

**预期结果**：
- 应该返回 `HTTP/1.1 400 Bad Request`（缺少参数是正常的，说明路由存在）
- 如果返回 `404 Not Found`，说明路由未正确部署

## 方法 2: 使用 wget（如果已安装）

```bash
# 测试路由
wget --spider -S "https://podcasttoinsight.top/mulerun/session" 2>&1 | grep "HTTP/"
```

## 方法 3: 使用浏览器测试

直接在浏览器中访问：
- `https://podcasttoinsight.top/mulerun/session`

**预期结果**：
- 应该显示错误页面（缺少必需参数），而不是 404
- 错误信息应该是 "Missing required parameters" 或类似内容

## 方法 4: 检查 PM2 日志

```bash
# 查看应用日志
pm2 logs podroom --lines 50

# 查看是否有 MuleRun 相关日志
pm2 logs podroom | grep -i mulerun
```

**预期看到**：
- `[MuleRun] 启动超时检测器（每 5 分钟检查一次）`
- 应用正常启动，没有严重错误

## 方法 5: 检查应用状态

```bash
# 查看 PM2 进程状态
pm2 list

# 查看应用信息
pm2 info podroom

# 检查环境变量
pm2 env podroom | grep MULERUN
```

**预期结果**：
- `pm2 list` 应该显示 `podroom` 进程状态为 `online`
- `pm2 env podroom` 应该显示所有 MuleRun 环境变量

## 方法 6: 检查 Nginx 配置

```bash
# 测试 Nginx 配置
sudo nginx -t

# 查看 Nginx 错误日志
sudo tail -20 /var/log/nginx/error.log

# 查看 Nginx 访问日志
sudo tail -20 /var/log/nginx/access.log
```

## 完整验证清单

- [ ] 应用已启动（`pm2 list` 显示 `online`）
- [ ] 应用日志无严重错误
- [ ] MuleRun 超时检测器已启动
- [ ] 环境变量已加载（`pm2 env podroom | grep MULERUN`）
- [ ] HTTPS 证书有效（`sudo certbot certificates`）
- [ ] Nginx 配置正确（`sudo nginx -t`）
- [ ] `/mulerun/session` 路由可访问（返回 400 而不是 404）
- [ ] 浏览器可以访问路由（显示错误页面而不是 404）

## 常见问题

### 问题 1: curl 未安装

**解决方案**：
```bash
sudo apt install curl -y
```

### 问题 2: 返回 404 Not Found

**可能原因**：
1. 应用未正确构建（检查 `.next` 目录）
2. 路由文件不存在
3. Nginx 配置错误

**检查**：
```bash
# 检查构建是否成功
ls -la .next/

# 检查路由文件
ls -la src/app/mulerun/session/

# 检查 Nginx 配置
sudo cat /etc/nginx/sites-available/podroom | grep proxy_pass
```

### 问题 3: 返回 502 Bad Gateway

**可能原因**：
1. 应用未启动
2. 应用端口不正确
3. Nginx 代理配置错误

**检查**：
```bash
# 检查应用是否运行
pm2 list

# 检查端口
sudo lsof -i :3005

# 检查 Nginx 配置中的端口
sudo cat /etc/nginx/sites-available/podroom | grep proxy_pass
```

### 问题 4: 返回 500 Internal Server Error

**可能原因**：
1. 应用启动失败
2. 数据库连接问题
3. 环境变量未加载

**检查**：
```bash
# 查看详细日志
pm2 logs podroom --lines 100

# 检查环境变量
pm2 env podroom
```

