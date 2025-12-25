# 通过API验证迁移（备用方法）

如果无法直接连接数据库，可以通过API来验证迁移是否成功。

---

## 验证步骤

### 1. 测试hot查询（如果likeCount不存在，查询会失败或很慢）

```bash
cd /opt/podroom

# 测试hot查询（应该很快，< 1秒，如果likeCount不存在会很慢）
time curl -s "http://localhost:3005/api/public/list?type=hot&limit=15" | jq '.items[0] | {id, title, likeCount}'
```

**预期输出**：
- 如果likeCount存在：应该很快返回（< 1秒），并且每个item都有`likeCount`字段
- 如果likeCount不存在：查询会很慢（> 5秒），或者返回错误

---

### 2. 测试hot_all查询

```bash
cd /opt/podroom

# 测试hot_all查询（应该很快，< 0.1秒）
time curl -s "http://localhost:3005/api/public/list?type=hot_all&limit=10" | jq '.items[0] | {id, title, likeCount}'
```

**预期输出**：
- 应该很快返回（< 0.1秒）
- 每个item都有`likeCount`字段

---

### 3. 检查应用日志

```bash
cd /opt/podroom

# 检查是否有likeCount相关的错误
pm2 logs podroom --out --lines 200 --nostream | grep -iE "likeCount|column.*not exist|does not exist" | tail -20
```

**预期输出**：
- 如果没有错误：应该没有输出或只有正常日志
- 如果有错误：会显示相关错误信息

---

### 4. 测试Summary API性能

```bash
cd /opt/podroom

# 测试Summary API（优化后应该很快，< 0.5秒）
time curl -s "http://localhost:3005/api/public/summary" | jq '.'
```

**预期输出**：
- 应该很快返回（< 0.5秒，优化后）
- 返回的数据包含`totalPodcasts`等字段

---

## 判断标准

### ✅ 迁移成功的标志

1. **hot查询很快**（< 1秒）
2. **hot_all查询很快**（< 0.1秒）
3. **返回的数据包含likeCount字段**
4. **没有数据库错误日志**
5. **Summary API很快**（< 0.5秒）

### ❌ 迁移失败的标志

1. **hot查询很慢**（> 5秒）
2. **返回的数据没有likeCount字段**
3. **有数据库错误日志**（如"column 'likeCount' does not exist"）
4. **API返回500错误**

---

## 如果验证失败

如果API测试显示likeCount不存在，需要在Supabase SQL Editor中执行创建SQL（见`VERIFY_IN_SUPABASE.md`）。

