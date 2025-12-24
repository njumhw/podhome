# 下一步诊断步骤

## 基于当前诊断结果的分析

### ✅ 已确认正常
- **数据库连接**：无连接错误
- **单次查询性能**：latest 0.3秒，hot 0.7秒（正常）

### 🔍 需要进一步诊断

问题可能不在数据库层面，而在：
1. **并发场景**（多个用户同时访问）
2. **前端错误处理**（没有重试机制）
3. **Nginx/反向代理配置**（超时设置）
4. **网络层面**（客户端到服务器的网络问题）

## 诊断步骤

### 步骤 1: 并发测试（最重要）

在服务器上执行以下命令，测试并发场景：

```bash
# 创建并发测试脚本
cat > /tmp/test_concurrent.sh << 'EOF'
#!/bin/bash
echo "=========================================="
echo "并发测试（模拟多个用户同时访问）"
echo "=========================================="
echo ""

echo "1. 并发测试 latest API (10个请求):"
time (for i in {1..10}; do
  curl -s http://localhost:3005/api/public/list?type=latest > /dev/null &
done
wait)

echo ""
echo "2. 并发测试 hot API (10个请求):"
time (for i in {1..10}; do
  curl -s http://localhost:3005/api/public/list?type=hot > /dev/null &
done
wait)

echo ""
echo "3. 混合并发测试 (同时请求 latest 和 hot，各5个):"
time (for i in {1..5}; do
  curl -s http://localhost:3005/api/public/list?type=latest > /dev/null &
  curl -s http://localhost:3005/api/public/list?type=hot > /dev/null &
done
wait)

echo ""
echo "4. 高并发测试 (20个请求同时):"
time (for i in {1..20}; do
  curl -s http://localhost:3005/api/public/list?type=hot > /dev/null &
done
wait)

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
EOF

chmod +x /tmp/test_concurrent.sh
/tmp/test_concurrent.sh
```

**观察点**：
- 是否有请求失败或超时？
- 响应时间是否显著增加？
- 是否有错误日志？

### 步骤 2: 检查 Nginx 配置

```bash
# 检查 Nginx 超时设置
echo "=== Nginx 超时配置 ==="
grep -i "timeout\|proxy_read_timeout\|proxy_connect_timeout\|proxy_send_timeout" /etc/nginx/sites-available/podroom

# 检查 Nginx 错误日志（实时）
echo ""
echo "=== Nginx 错误日志（按 Ctrl+C 退出）==="
tail -f /var/log/nginx/error.log
```

**关键配置**：
- `proxy_read_timeout`：应该 >= 60秒
- `proxy_connect_timeout`：应该 >= 10秒
- `proxy_send_timeout`：应该 >= 60秒

### 步骤 3: 检查应用日志中的错误模式

```bash
# 查看最近的错误日志
echo "=== 最近的错误日志 ==="
pm2 logs podroom --err --lines 50 --nostream

# 查看最近的输出日志（查找超时或错误）
echo ""
echo "=== 查找超时或错误 ==="
pm2 logs podroom --out --lines 200 --nostream | grep -i "error\|timeout\|fail\|503\|408\|500"

# 查看 API 请求日志（查找慢查询）
echo ""
echo "=== API 请求日志（查找慢查询）==="
pm2 logs podroom --out --lines 200 --nostream | grep "\[API" | tail -20
```

### 步骤 4: 检查查询耗时日志

```bash
# 查看查询耗时（使用正确的日志格式）
echo "=== 查询耗时日志 ==="
pm2 logs podroom --out --lines 200 --nostream | grep -E "查询耗时|耗时=|query.*time" | tail -20

# 或者查看所有包含时间的日志
pm2 logs podroom --out --lines 200 --nostream | grep -E "ms|秒" | tail -20
```

### 步骤 5: 检查前端错误（在浏览器中）

1. **打开浏览器开发者工具**（F12）
2. **切换到 Network 标签**
3. **刷新页面**
4. **观察**：
   - 哪些请求失败了？
   - 失败的状态码是什么？（408, 503, 500等）
   - 请求耗时是多少？
   - 是否有超时错误？

5. **切换到 Console 标签**
6. **观察**：
   - 是否有 JavaScript 错误？
   - 是否有 API 错误日志？

## 预期结果分析

### 如果并发测试失败
- **问题**：数据库连接池或资源竞争
- **解决**：增加连接池大小，优化查询性能

### 如果 Nginx 超时设置太短
- **问题**：Nginx 在请求完成前就超时了
- **解决**：增加 Nginx 超时时间

### 如果前端请求超时
- **问题**：前端超时时间不够，或网络延迟高
- **解决**：增加前端超时时间，添加重试机制

### 如果日志中有大量错误
- **问题**：根据错误类型判断（503=数据库，408=超时，500=服务器错误）
- **解决**：根据具体错误类型修复

## 快速修复建议（基于常见问题）

如果诊断时间有限，可以先实施以下快速修复：

### 1. 增加前端超时和重试（最快）
- 前端超时从 30 秒增加到 60 秒
- 添加自动重试机制（失败后重试 2-3 次）

### 2. 检查并优化 Nginx 配置
- 确保 `proxy_read_timeout >= 60s`
- 确保 `proxy_connect_timeout >= 10s`

### 3. 改进缓存策略
- 延长缓存时间，减少数据库查询压力

