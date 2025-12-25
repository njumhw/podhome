# 性能问题诊断步骤

## 问题现象
1. 主页加载巨慢，播客数量没有加载出来
2. 播客详情页请求超时
3. 最热界面不能切换（近30天/全量Top10）

## 诊断步骤

### 步骤 1: 检查服务器基础状态

```bash
# 1. 检查服务器资源使用情况
top -bn1 | head -20
free -h
df -h

# 2. 检查PM2进程状态
pm2 status
pm2 logs podroom --lines 50 --nostream | tail -50

# 3. 检查端口占用
netstat -tlnp | grep :3005
lsof -i:3005
```

### 步骤 2: 检查数据库连接

```bash
cd /opt/podroom

# 1. 测试数据库连接
npx prisma db execute --stdin <<'EOF'
SELECT 1 as test;
EOF

# 2. 检查数据库连接池状态（如果可能）
# 查看 Prisma 连接配置
cat .env | grep DATABASE_URL

# 3. 检查数据库响应时间
time npx prisma db execute --stdin <<'EOF'
SELECT COUNT(*) FROM "Podcast" WHERE status = 'READY';
EOF
```

### 步骤 3: 检查API响应时间

```bash
cd /opt/podroom

# 1. 测试 summary API
time curl -s "http://localhost:3005/api/public/summary" | head -100

# 2. 测试 latest API
time curl -s "http://localhost:3005/api/public/list?type=latest&limit=9" | head -100

# 3. 测试 hot API
time curl -s "http://localhost:3005/api/public/list?type=hot&limit=15" | head -100

# 4. 测试 podcast 详情 API（使用一个真实的ID）
time curl -s "http://localhost:3005/api/public/podcast?id=YOUR_PODCAST_ID" | head -100
```

### 步骤 4: 检查应用日志

```bash
cd /opt/podroom

# 1. 查看最近的错误日志
pm2 logs podroom --err --lines 100 --nostream | tail -50

# 2. 查看最近的输出日志
pm2 logs podroom --out --lines 200 --nostream | grep -E "error|timeout|slow|查询|API" | tail -50

# 3. 查看数据库查询相关日志
pm2 logs podroom --out --lines 500 --nostream | grep -E "查询|query|database|connection|P1001|P1017" | tail -50
```

### 步骤 5: 检查数据库查询性能

```bash
cd /opt/podroom

# 1. 检查 summary 查询性能
time npx prisma db execute --stdin <<'EOF'
SELECT COUNT(*) as total FROM "Podcast" WHERE status = 'READY';
SELECT COUNT(*) as total FROM "Podcast" WHERE status = 'PROCESSING';
SELECT COUNT(*) as total FROM "Podcast" WHERE status = 'FAILED';
EOF

# 2. 检查 latest 查询性能
time npx prisma db execute --stdin <<'EOF'
SELECT id, title, "updatedAt" 
FROM "Podcast" 
WHERE status = 'READY' 
ORDER BY "updatedAt" DESC 
LIMIT 9;
EOF

# 3. 检查 hot 查询性能（使用 likeCount）
time npx prisma db execute --stdin <<'EOF'
SELECT id, title, "likeCount", "updatedAt" 
FROM "Podcast" 
WHERE status = 'READY' 
  AND "updatedAt" >= NOW() - INTERVAL '30 days'
ORDER BY "likeCount" DESC, "updatedAt" DESC 
LIMIT 15;
EOF

# 4. 检查 podcast 详情查询性能
time npx prisma db execute --stdin <<'EOF'
SELECT id, title, summary, "translatedSummary" 
FROM "Podcast" 
WHERE id = 'YOUR_PODCAST_ID';
EOF
```

### 步骤 6: 检查网络和Nginx

```bash
# 1. 检查Nginx状态
systemctl status nginx
nginx -t

# 2. 检查Nginx错误日志
tail -50 /var/log/nginx/error.log

# 3. 检查Nginx访问日志（最近的慢请求）
tail -100 /var/log/nginx/access.log | grep -E "slow|timeout"

# 4. 测试外部访问
curl -I https://podcasttoinsight.top/api/public/summary
curl -I https://podcasttoinsight.top/api/public/list?type=latest&limit=9
```

### 步骤 7: 检查最近的代码变更

```bash
cd /opt/podroom

# 1. 查看最近的提交
git log --oneline -10

# 2. 检查是否有未提交的更改
git status

# 3. 检查 .env 文件是否有变化
ls -la .env
```

---

## 可能的原因分析

### 1. 数据库连接问题
- **症状**：所有API都慢或超时
- **检查**：步骤2和步骤4
- **可能原因**：
  - 数据库连接池耗尽
  - 数据库服务器响应慢
  - 网络延迟

### 2. 数据库查询慢
- **症状**：特定API慢（如summary、hot）
- **检查**：步骤5
- **可能原因**：
  - 缺少索引
  - 数据量大
  - 查询逻辑有问题

### 3. 应用代码问题
- **症状**：特定功能不工作（如切换按钮）
- **检查**：步骤7和浏览器控制台
- **可能原因**：
  - 代码逻辑错误
  - 缓存问题
  - 状态管理问题

### 4. 服务器资源不足
- **症状**：整体变慢
- **检查**：步骤1
- **可能原因**：
  - CPU/内存不足
  - 磁盘空间不足
  - 进程过多

### 5. 网络问题
- **症状**：外部访问慢，但本地访问正常
- **检查**：步骤6
- **可能原因**：
  - Nginx配置问题
  - 网络延迟
  - CDN问题

---

## 快速诊断脚本

```bash
#!/bin/bash
# 快速诊断脚本

echo "=== 1. 服务器资源 ==="
echo "CPU和内存："
top -bn1 | head -5
free -h | head -2

echo ""
echo "=== 2. PM2状态 ==="
pm2 status

echo ""
echo "=== 3. 数据库连接测试 ==="
cd /opt/podroom
timeout 5 npx prisma db execute --stdin <<'EOF' 2>&1 | head -5
SELECT 1 as test;
EOF

echo ""
echo "=== 4. API响应时间 ==="
echo "Summary API:"
time curl -s -m 10 "http://localhost:3005/api/public/summary" > /dev/null 2>&1

echo "Latest API:"
time curl -s -m 10 "http://localhost:3005/api/public/list?type=latest&limit=9" > /dev/null 2>&1

echo ""
echo "=== 5. 最近错误日志 ==="
pm2 logs podroom --err --lines 20 --nostream | tail -10
```

---

## 下一步行动

根据诊断结果，我们可以：
1. 如果是数据库问题 → 优化查询或增加连接池
2. 如果是代码问题 → 修复bug
3. 如果是服务器问题 → 扩容或优化配置
4. 如果是网络问题 → 检查Nginx和网络配置

