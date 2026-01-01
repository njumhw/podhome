# 前端无法访问诊断步骤

## 问题现象
- 应用已上线（pm2 restart成功）
- 前端打不开
- 服务器出现 `/usr/bin/.update: No such file or directory` 错误

## 诊断步骤

### 1. 检查PM2应用状态
```bash
pm2 list
pm2 logs podroom --lines 50
pm2 describe podroom
```

### 2. 检查应用端口是否监听
```bash
# 检查3005端口是否监听
netstat -tlnp | grep 3005
# 或
ss -tlnp | grep 3005
# 或
lsof -i :3005
```

### 3. 检查Nginx状态和配置
```bash
# 检查Nginx状态
systemctl status nginx

# 检查Nginx配置
nginx -t

# 检查Nginx错误日志
tail -50 /var/log/nginx/error.log

# 检查Nginx访问日志
tail -50 /var/log/nginx/access.log
```

### 4. 检查应用是否能本地访问
```bash
# 在服务器上测试本地访问
curl -I http://localhost:3005
curl http://localhost:3005/api/public/list?type=latest
```

### 5. 检查防火墙和端口
```bash
# 检查防火墙状态
ufw status
# 或
iptables -L -n

# 检查端口是否开放
telnet localhost 3005
```

### 6. 检查应用构建
```bash
# 检查.next目录是否存在
ls -la .next

# 检查构建是否成功
ls -la .next/static
```

### 7. 检查环境变量
```bash
# 检查.env文件
cat .env | grep -v "PASSWORD\|SECRET\|KEY" | head -20

# 检查PM2环境变量
pm2 env 0
```

## 常见问题

### 问题1：应用未启动
**症状**：pm2 list显示status不是online
**解决**：
```bash
pm2 restart podroom
pm2 logs podroom --lines 100
```

### 问题2：端口未监听
**症状**：netstat显示3005端口未监听
**解决**：
- 检查应用是否真的启动了
- 检查.env中的PORT配置
- 检查应用日志中的错误

### 问题3：Nginx配置错误
**症状**：Nginx错误日志有错误
**解决**：
```bash
nginx -t  # 检查配置
systemctl reload nginx  # 重新加载配置
```

### 问题4：构建失败
**症状**：.next目录不存在或为空
**解决**：
```bash
rm -rf .next
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
pm2 restart podroom
```

### 问题5：/usr/bin/.update错误
**症状**：每次执行命令都出现这个错误
**解决**：
- 这个错误不影响应用运行，只是shell配置问题
- 可以忽略，或修复shell配置文件

## 快速诊断命令
```bash
# 一键诊断
echo "=== PM2状态 ===" && pm2 list && \
echo "=== 端口监听 ===" && netstat -tlnp | grep 3005 && \
echo "=== Nginx状态 ===" && systemctl status nginx --no-pager && \
echo "=== 本地测试 ===" && curl -I http://localhost:3005 && \
echo "=== 应用日志（最后20行）===" && pm2 logs podroom --lines 20 --nostream
```

