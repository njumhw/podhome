# 问题诊断方案（2025-12-25）

## 问题描述

1. **最近30天的hot查询失败**：全量top10正常，但最近30天的hot没有数据
2. **播客详情页超时**：显示"播客不存在"，请求超时

---

## 诊断步骤

### 问题1：最近30天的hot查询失败

#### 步骤1：检查API响应

```bash
cd /opt/podroom

# 测试hot查询（30天）
time curl -s "http://localhost:3005/api/public/list?type=hot&limit=15" | jq '.' | head -50

# 检查返回的数据
curl -s "http://localhost:3005/api/public/list?type=hot&limit=15" | jq '.items | length'
```

**预期**：
- 如果正常：应该返回15个播客
- 如果失败：可能返回空数组或错误

#### 步骤2：检查应用日志

```bash
cd /opt/podroom

# 检查hot查询相关的日志
pm2 logs podroom --out --lines 500 --nostream | grep -iE "hot|热门|likeCount" | tail -30
```

**查看**：
- 是否有错误信息
- 查询是否执行
- likeCount字段是否有问题

#### 步骤3：检查数据库查询

```bash
cd /opt/podroom

# 测试hot查询的SQL逻辑（如果可以直接连接数据库）
# 注意：如果无法连接，跳过这一步
```

#### 步骤4：检查代码逻辑

检查 `src/app/api/public/list/route.ts` 中的hot查询逻辑：
- orderBy是否正确
- where条件是否正确
- likeCount字段的使用是否正确

---

### 问题2：播客详情页超时

#### 步骤1：检查API响应

```bash
cd /opt/podroom

# 测试播客详情API（使用一个真实的ID）
# 先获取一个播客ID
PODCAST_ID=$(curl -s "http://localhost:3005/api/public/list?type=latest&limit=1" | jq -r '.items[0].id')

# 测试详情API
time curl -s "http://localhost:3005/api/public/podcast?id=$PODCAST_ID" | head -100
```

**预期**：
- 如果正常：应该返回播客详情
- 如果超时：请求会超时或返回错误

#### 步骤2：检查应用日志

```bash
cd /opt/podroom

# 检查播客详情查询相关的日志
pm2 logs podroom --out --lines 500 --nostream | grep -iE "podcast.*detail|播客详情|podcast.*id|timeout|超时" | tail -30
```

**查看**：
- 是否有超时错误
- 查询是否执行
- 是否有数据库连接问题

#### 步骤3：检查代码逻辑

检查 `src/app/api/public/podcast/route.ts` 中的查询逻辑：
- 查询条件是否正确
- 超时设置是否合理
- 是否有慢查询

---

## 可能的原因分析

### 问题1：最近30天的hot查询失败

**可能原因**：
1. **orderBy修改导致查询失败**：我们刚刚修改了orderBy使用likeCount，可能有问题
2. **where条件问题**：30天的过滤条件可能有问题
3. **likeCount字段问题**：虽然字段存在，但查询时可能有问题
4. **去重逻辑问题**：去重逻辑可能有问题

### 问题2：播客详情页超时

**可能原因**：
1. **查询超时设置太短**：虽然设置了30秒，但可能还是不够
2. **数据库连接问题**：连接池可能有问题
3. **查询本身很慢**：查询逻辑可能有问题
4. **缓存问题**：缓存可能有问题

---

## 下一步行动

1. **先执行诊断步骤**，收集信息
2. **分析日志和错误信息**，定位问题
3. **针对性修复**，不要盲目修改

