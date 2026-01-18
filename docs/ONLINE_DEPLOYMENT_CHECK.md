# 线上部署检查清单

## 我刚刚做的代码修改

### 1. 修复搜索API的URL标准化问题
**文件**: `src/app/api/public/search/route.ts`
- 添加了URL标准化逻辑
- 同时搜索原始URL和标准化URL，确保能找到已处理的播客

### 2. 修复任务队列的URL标准化问题
**文件**: `src/server/task-queue.ts`
- 在 `checkCompletedTasks` 中添加了URL标准化
- 确保任务状态检查时能正确匹配已保存的播客

**这些修改不会影响播客处理流程本身，只是修复了"播客已处理成功但前端显示失败"的问题。**

## 线上配置检查清单

### 1. OSS配置（最重要）⚠️

**检查方法**：
```bash
# SSH到服务器
ssh your-server

# 检查环境变量
cd /opt/podroom  # 或你的项目路径
cat .env | grep ALIYUN
```

**必须包含的变量**：
```bash
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
ALIYUN_OSS_REGION=cn-hangzhou  # 或你的region，不要带oss-前缀
ALIYUN_OSS_BUCKET=your_bucket_name
```

**注意事项**：
- `ALIYUN_OSS_REGION` 应该是 `cn-hangzhou` 格式，代码会自动添加 `oss-` 前缀
- 确保变量值没有多余的空格、引号或换行符
- 确保AccessKey有OSS写入权限

### 2. 代码版本检查

**检查方法**：
```bash
cd /opt/podroom
git log --oneline -5
# 查看是否有最新的URL标准化修复提交
```

**更新代码**：
```bash
cd /opt/podroom
git pull origin main
# 如果使用PM2
pm2 restart podroom
# 如果使用Docker
docker-compose restart
```

### 3. 网络连接检查

**测试OSS连接**：
```bash
# 测试OSS域名解析
nslookup your-bucket.oss-cn-hangzhou.aliyuncs.com

# 测试HTTPS连接
curl -I https://your-bucket.oss-cn-hangzhou.aliyuncs.com/
```

### 4. 数据库连接检查

**检查方法**：
```bash
# 检查数据库环境变量
cat .env | grep DATABASE_URL
```

### 5. 运行时检查

**查看应用日志**：
```bash
# PM2
pm2 logs podroom --lines 100

# Docker
docker-compose logs --tail=100

# 直接运行
tail -f /tmp/nextjs-3001.log
```

**查找OSS相关错误**：
```bash
# 在日志中搜索OSS错误
grep -i "oss\|上传失败\|OSS配置" /path/to/logfile
```

## 常见问题排查

### 问题1: OSS上传失败

**症状**: `ASR转写失败: OSS上传失败: 分段上传失败`

**排查步骤**:
1. 检查环境变量是否设置正确
2. 检查AccessKey权限（需要 `oss:PutObject` 权限）
3. 检查Bucket是否允许写入
4. 检查网络连接（防火墙、安全组）

### 问题2: 播客处理成功但前端显示失败

**症状**: 播客已保存到数据库，但前端显示处理失败

**原因**: URL标准化问题（已修复）

**解决**: 确保代码已更新到最新版本

### 问题3: 任务一直处于RUNNING状态

**症状**: 任务状态一直是RUNNING，不更新为READY或FAILED

**排查步骤**:
1. 检查任务队列是否正常运行
2. 查看服务器日志，确认任务是否真的在处理
3. 检查数据库中的任务状态

## 快速诊断脚本

在服务器上运行：

```bash
#!/bin/bash
echo "=== OSS配置检查 ==="
cd /opt/podroom
echo "ALIYUN_ACCESS_KEY_ID: $(grep ALIYUN_ACCESS_KEY_ID .env | cut -d'=' -f2 | head -c 10)..."
echo "ALIYUN_OSS_REGION: $(grep ALIYUN_OSS_REGION .env | cut -d'=' -f2)"
echo "ALIYUN_OSS_BUCKET: $(grep ALIYUN_OSS_BUCKET .env | cut -d'=' -f2)"
echo ""
echo "=== 代码版本 ==="
git log --oneline -1
echo ""
echo "=== 最近的任务状态 ==="
# 如果有数据库访问工具，可以查询任务状态
```

## 部署后验证

1. **测试播客处理**:
   - 上传一个简单的播客URL
   - 观察处理过程
   - 检查是否成功保存

2. **检查日志**:
   - 确认没有OSS配置错误
   - 确认URL标准化正常工作

3. **验证搜索功能**:
   - 处理完成后，尝试通过URL搜索
   - 确认能找到已处理的播客
