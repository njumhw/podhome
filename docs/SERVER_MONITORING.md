# 服务器性能监控指南

## 1. PM2 应用监控

### 查看应用状态
```bash
# 查看所有 PM2 进程状态
pm2 list

# 查看详细信息（CPU、内存使用）
pm2 monit

# 查看实时日志
pm2 logs podroom --lines 100

# 查看应用详细信息
pm2 describe podroom

# 查看应用指标（CPU、内存、重启次数等）
pm2 show podroom
```

### PM2 性能指标说明
- **CPU %**: CPU 使用率
- **Memory**: 内存使用量
- **Restarts**: 重启次数（如果频繁重启说明有问题）
- **Uptime**: 运行时长

## 2. 系统资源监控

### CPU 和内存使用情况
```bash
# 实时监控系统资源（按 q 退出）
top

# 或者使用更友好的界面
htop  # 如果已安装

# 查看系统负载
uptime

# 查看内存使用情况
free -h

# 查看磁盘使用情况
df -h
```

### 查看特定进程的资源使用
```bash
# 查看 Node.js 进程的资源使用
ps aux | grep node

# 或者更详细的
ps aux | grep -E "node|next" | grep -v grep
```

## 3. 应用日志监控

### 实时日志查看
```bash
# PM2 日志（实时）
pm2 logs podroom --lines 200

# 查看错误日志
pm2 logs podroom --err --lines 100

# 查看输出日志
pm2 logs podroom --out --lines 100

# 清空日志并重新开始
pm2 flush podroom
```

### 日志文件位置
```bash
# PM2 日志目录
~/.pm2/logs/

# 查看最新的错误日志
tail -f ~/.pm2/logs/podroom-error.log

# 查看最新的输出日志
tail -f ~/.pm2/logs/podroom-out.log
```

## 4. 网络连接监控

### 查看端口监听情况
```bash
# 查看 3005 端口是否在监听
netstat -tlnp | grep 3005

# 或者使用 ss 命令（更现代）
ss -tlnp | grep 3005

# 查看所有 Node.js 相关的网络连接
netstat -anp | grep node
```

### 查看连接数
```bash
# 查看当前连接数
netstat -an | grep :3005 | wc -l

# 查看 ESTABLISHED 连接数
netstat -an | grep :3005 | grep ESTABLISHED | wc -l
```

## 5. 数据库连接监控

### 检查数据库连接
```bash
# 在应用目录下运行
cd /opt/podroom
npx prisma db execute --stdin <<< "SELECT 1;"
```

### 查看数据库连接池状态（如果应用有暴露）
```bash
# 查看应用健康检查端点（如果有）
curl http://localhost:3005/api/health
```

## 6. 应用性能指标

### 响应时间测试
```bash
# 测试首页响应时间
time curl -s http://localhost:3005/home > /dev/null

# 测试 API 响应时间
time curl -s http://localhost:3005/api/public/list?type=latest > /dev/null

# 测试多个请求的平均响应时间
for i in {1..10}; do time curl -s http://localhost:3005/api/public/list?type=latest > /dev/null; done
```

### 查看 HTTP 状态码
```bash
# 检查应用是否正常响应
curl -I http://localhost:3005/home

# 检查 API 是否正常
curl -I http://localhost:3005/api/public/list?type=latest
```

## 7. 一键性能检查脚本

创建一个快速检查脚本：

```bash
# 创建检查脚本
cat > /opt/podroom/check-performance.sh << 'EOF'
#!/bin/bash
echo "=========================================="
echo "应用性能检查报告"
echo "=========================================="
echo ""
echo "1. PM2 应用状态:"
pm2 list
echo ""
echo "2. 系统负载:"
uptime
echo ""
echo "3. 内存使用:"
free -h
echo ""
echo "4. 磁盘使用:"
df -h | grep -E "Filesystem|/dev/"
echo ""
echo "5. 3005 端口监听:"
netstat -tlnp | grep 3005 || echo "端口未监听！"
echo ""
echo "6. 当前连接数:"
netstat -an | grep :3005 | grep ESTABLISHED | wc -l
echo ""
echo "7. 应用响应测试:"
time curl -s -o /dev/null -w "HTTP状态码: %{http_code}, 响应时间: %{time_total}s\n" http://localhost:3005/home
echo ""
echo "8. 最近 10 条错误日志:"
pm2 logs podroom --err --lines 10 --nostream
echo ""
echo "=========================================="
EOF

chmod +x /opt/podroom/check-performance.sh
```

使用方式：
```bash
/opt/podroom/check-performance.sh
```

## 8. 持续监控（推荐）

### 使用 PM2 内置监控
```bash
# 启动 PM2 监控面板（需要安装 pm2-web）
pm2 web

# 或者使用 PM2 Plus（需要注册）
pm2 link
```

### 设置日志轮转
```bash
# 安装 PM2 日志轮转模块
pm2 install pm2-logrotate

# 配置日志轮转（保留最近 7 天，最大 10M）
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## 9. 性能问题排查清单

如果发现性能问题，按以下顺序检查：

1. **应用是否在运行？**
   ```bash
   pm2 list
   ```

2. **应用是否频繁重启？**
   ```bash
   pm2 show podroom | grep restarts
   ```

3. **内存是否不足？**
   ```bash
   free -h
   pm2 show podroom | grep memory
   ```

4. **CPU 使用率是否过高？**
   ```bash
   top
   pm2 monit
   ```

5. **数据库连接是否正常？**
   ```bash
   pm2 logs podroom --err --lines 50 | grep -i "database\|prisma\|P1001"
   ```

6. **网络连接是否正常？**
   ```bash
   curl -I http://localhost:3005/home
   ```

7. **是否有错误日志？**
   ```bash
   pm2 logs podroom --err --lines 100
   ```

## 10. 常用监控命令速查

```bash
# 快速查看应用状态
pm2 list && pm2 show podroom

# 实时监控（推荐）
pm2 monit

# 查看实时日志
pm2 logs podroom

# 系统资源
top
free -h
df -h

# 网络连接
netstat -tlnp | grep 3005
ss -tlnp | grep 3005

# 应用健康检查
curl -I http://localhost:3005/home
```

## 11. 性能优化建议

### 如果内存使用过高
- 检查是否有内存泄漏
- 考虑增加服务器内存
- 检查 PM2 的 `max_memory_restart` 配置

### 如果 CPU 使用过高
- 检查是否有 CPU 密集型任务
- 考虑使用多进程（PM2 cluster 模式）
- 检查是否有无限循环或递归

### 如果响应时间慢
- 检查数据库查询是否优化
- 检查是否有慢查询
- 检查网络延迟
- 检查缓存是否生效

### 如果频繁重启
- 查看错误日志找出原因
- 检查内存限制
- 检查未捕获的异常

