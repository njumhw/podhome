# OSS上传问题诊断和修复指南

## 问题描述

播客处理时出现错误：`所有22个音频分段OSS上传均失败`

## 本地测试结果

✅ **本地OSS配置正常**：测试脚本 `scripts/test-oss-config-quick.ts` 可以成功上传文件

## 可能的原因

### 1. 服务器环境变量未正确设置 ⚠️ **最可能**

**检查方法**：
```bash
# 在服务器上检查环境变量
cd /opt/podroom
grep -E "ALIYUN_ACCESS_KEY_ID|ALIYUN_ACCESS_KEY_SECRET|ALIYUN_OSS_REGION|ALIYUN_OSS_BUCKET" .env
```

**修复方法**：
1. 确保 `.env` 文件中包含以下变量：
   ```
   ALIYUN_ACCESS_KEY_ID=your_access_key_id
   ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
   ALIYUN_OSS_REGION=cn-hangzhou
   ALIYUN_OSS_BUCKET=ttxxyz
   ```
2. 确保变量值没有多余的空格或引号
3. 重启应用以加载新的环境变量

### 2. 服务器代码版本不是最新的 ⚠️ **很可能**

**检查方法**：
```bash
# 在服务器上检查代码版本
cd /opt/podroom
git log --oneline -5
# 查看是否有最新的OSS修复提交
```

**修复方法**：
```bash
cd /opt/podroom
git pull origin main
# 如果使用PM2，重启应用
pm2 restart podroom
```

### 3. 服务器网络连接问题

**检查方法**：
```bash
# 测试OSS连接
curl -I https://ttxxyz.oss-cn-hangzhou.aliyuncs.com/
```

**修复方法**：
- 检查服务器防火墙设置
- 检查阿里云安全组规则（确保允许出站HTTPS连接）

### 4. OSS权限问题

**检查方法**：
- 登录阿里云控制台
- 检查AccessKey是否有OSS写入权限
- 检查Bucket是否允许公共读

**修复方法**：
- 确保AccessKey有 `oss:PutObject` 权限
- 确保Bucket设置为公共读或允许通过AccessKey访问

## 诊断步骤

### 步骤1: 检查服务器环境变量

```bash
cd /opt/podroom
cat .env | grep ALIYUN
```

**预期输出**：
```
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_OSS_REGION=cn-hangzhou
ALIYUN_OSS_BUCKET=ttxxyz
```

### 步骤2: 在服务器上运行OSS测试脚本

```bash
cd /opt/podroom
npx tsx scripts/test-oss-config-quick.ts
```

**预期输出**：
```
✅ OSS配置正常，可以正常上传文件
```

如果失败，查看详细错误信息。

### 步骤3: 检查服务器日志

```bash
# 如果使用PM2
pm2 logs podroom --lines 100 | grep -i oss

# 或者查看Next.js日志
# 查找 "OSS客户端未配置" 或 "OSS上传失败" 的错误
```

### 步骤4: 检查代码版本

```bash
cd /opt/podroom
git log --oneline -10 | grep -i "oss\|storage"
```

确保包含最新的OSS修复（运行时读取环境变量）。

## 修复方案

### 方案1: 更新代码并重启（推荐）

```bash
cd /opt/podroom
# 1. 拉取最新代码
git pull origin main

# 2. 检查.env文件
cat .env | grep ALIYUN

# 3. 如果使用PM2，重启应用
pm2 restart podroom

# 4. 查看日志确认
pm2 logs podroom --lines 50
```

### 方案2: 手动检查并修复环境变量

```bash
cd /opt/podroom
# 1. 编辑.env文件
nano .env

# 2. 确保以下变量正确设置（无引号，无多余空格）：
# ALIYUN_ACCESS_KEY_ID=your_key
# ALIYUN_ACCESS_KEY_SECRET=your_secret
# ALIYUN_OSS_REGION=cn-hangzhou
# ALIYUN_OSS_BUCKET=ttxxyz

# 3. 保存并重启应用
pm2 restart podroom
```

### 方案3: 验证OSS配置

```bash
# 在服务器上运行测试脚本
cd /opt/podroom
npx tsx scripts/test-oss-config-quick.ts
```

如果测试失败，根据错误信息进一步诊断。

## 增强的日志记录

最新代码已增强日志记录，会在以下情况输出详细信息：

1. **环境变量检查失败**：会列出所有ALIYUN相关环境变量的状态
2. **OSS客户端创建失败**：会输出详细的错误信息
3. **OSS上传失败**：会输出错误代码、HTTP状态、请求ID等详细信息

查看服务器日志时，查找以下关键词：
- `OSS环境变量检查失败`
- `OSS客户端未配置`
- `OSS上传失败`
- `成功上传 X/Y 个片段到OSS`

## 预防措施

1. **环境变量验证**：在应用启动时验证所有必需的OSS环境变量
2. **健康检查**：定期运行OSS测试脚本，确保配置正常
3. **监控告警**：监控OSS上传失败率，超过阈值时发送告警

## 相关文件

- `src/server/storage.ts` - OSS上传核心逻辑
- `src/server/asr-segmented.ts` - ASR分段处理（调用OSS上传）
- `scripts/test-oss-config-quick.ts` - OSS配置测试脚本

