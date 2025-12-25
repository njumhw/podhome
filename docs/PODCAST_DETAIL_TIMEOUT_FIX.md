# 播客详情页超时问题修复

## 问题现象
- 返回"数据库连接问题，请稍后重试"
- 响应时间正好是5.326秒（接近5秒超时）
- 说明查询超时了

## 可能原因
1. **查询确实很慢**：查询大字段（transcript等）需要很长时间
2. **数据库连接问题**：连接池耗尽或网络问题
3. **超时设置太短**：5秒可能不够

## 诊断步骤

### 1. 查看详细日志
```bash
cd /opt/podroom

# 查看播客详情查询的详细日志
pm2 logs podroom --out --lines 500 --nostream | grep -A 10 "查询播客\|播客详情查询超时\|Podcast表查询错误" | tail -40
```

### 2. 测试数据库连接
```bash
cd /opt/podroom

# 测试简单的数据库查询
time npx prisma db execute --stdin <<'EOF'
SELECT id, title FROM "Podcast" WHERE id = 'cmjl2axe90005lyuqvpj52oes' LIMIT 1;
EOF
```

### 3. 测试不查询大字段的查询
```bash
cd /opt/podroom

# 测试只查询小字段
time npx prisma db execute --stdin <<'EOF'
SELECT id, title, "showAuthor", "publishedAt", "audioUrl", "sourceUrl", "updatedAt" 
FROM "Podcast" 
WHERE id = 'cmjl2axe90005lyuqvpj52oes' 
LIMIT 1;
EOF
```

## 修复方案

### 方案1：增加超时时间（临时方案）
如果查询确实需要更长时间，可以增加到10-15秒

### 方案2：优化查询（推荐）
- 延迟加载大字段（transcript等）
- 或者分页加载大字段
- 或者使用流式传输

### 方案3：检查数据库连接
- 检查连接池配置
- 检查网络连接
- 检查数据库服务器状态

