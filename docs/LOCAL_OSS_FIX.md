# 本地OSS上传问题修复指南

## 问题描述

在本地开发环境中处理播客时，出现错误：`所有22个音频分段OSS上传均失败`

## 已完成的修复

### 1. 增强OSS上传日志记录
- 在 `src/server/storage.ts` 中增加了详细的上传前日志
- 记录文件大小、Content-Type、Bucket、Region等信息
- 在失败时输出完整的错误对象和OSS错误代码

### 2. 增强ASR分段处理日志
- 在 `src/server/asr-segmented.ts` 中增加了环境变量检查日志
- 在每个片段上传前记录环境变量状态
- 在失败时输出详细的诊断信息

### 3. 创建调试工具
- `src/app/api/debug/oss-env/route.ts` - 检查API路由中的环境变量
- `scripts/test-oss-config-quick.ts` - 快速测试OSS配置
- `scripts/test-podcast-processing-local.ts` - 测试完整播客处理流程

## 诊断步骤

### 步骤1: 检查环境变量（已确认正常）

```bash
# 检查.env文件
cat .env | grep ALIYUN

# 通过API检查运行时环境变量
curl http://localhost:4000/api/debug/oss-env
```

**结果**: ✅ 环境变量已正确配置

### 步骤2: 重启开发服务器

**重要**: 必须重启开发服务器以应用新的日志增强！

```bash
# 停止当前开发服务器（Ctrl+C）
# 然后重新启动
pnpm dev
```

### 步骤3: 重新处理播客并查看日志

1. 在浏览器中重新提交播客URL
2. 查看开发服务器的控制台输出
3. 查找以下关键日志：
   - `[OSS上传] 开始上传:` - 每个片段的上传开始
   - `[OSS上传] 文件大小:` - 文件大小信息
   - `[ASR分段] 环境变量检查:` - 环境变量状态
   - `❌ OSS上传失败` - 失败详情

### 步骤4: 分析错误日志

根据日志中的错误信息，可能的原因：

#### 情况1: 环境变量未加载
**日志特征**: 
```
❌ OSS环境变量检查失败:
   ALIYUN_ACCESS_KEY_ID: ❌ 未设置
```

**解决方案**:
- 确保 `.env` 文件在项目根目录
- 重启开发服务器
- 检查 `.env` 文件格式（无引号，无多余空格）

#### 情况2: OSS客户端创建失败
**日志特征**:
```
❌ 创建OSS客户端失败: [错误信息]
```

**解决方案**:
- 检查AccessKey是否正确
- 检查Region格式（应为 `cn-hangzhou`，不是 `oss-cn-hangzhou`）
- 检查网络连接

#### 情况3: OSS上传失败（网络/权限）
**日志特征**:
```
❌ OSS上传失败: [错误代码]
   错误代码: AccessDenied
   或
   错误代码: InvalidAccessKeyId
```

**解决方案**:
- **AccessDenied**: 检查AccessKey是否有OSS写入权限
- **InvalidAccessKeyId**: 检查AccessKey是否正确
- **网络错误**: 检查防火墙或代理设置

#### 情况4: 文件格式问题
**日志特征**:
```
❌ OSS上传失败: 文件过大
   或
❌ 分段处理失败: 切分后的片段为空
```

**解决方案**:
- 检查音频文件是否完整
- 检查ffmpeg是否正确安装

## 快速测试

### 测试1: OSS配置测试
```bash
npx tsx scripts/test-oss-config-quick.ts
```

**预期输出**: `✅ OSS配置正常，可以正常上传文件`

### 测试2: 完整处理流程测试（可选）
```bash
# 注意：这会实际处理播客，需要几分钟
npx tsx scripts/test-podcast-processing-local.ts
```

## 下一步

1. **重启开发服务器**（必须！）
2. **重新处理播客** `https://www.xiaoyuzhoufm.com/episode/6935c8483fec3166cfc5d162`
3. **查看详细日志**，找到具体的失败原因
4. **根据错误信息**应用相应的修复方案

## 常见问题

### Q: 为什么测试脚本可以上传，但实际处理时失败？
A: 可能是：
1. 开发服务器没有重启，使用的是旧代码
2. 任务队列处理时环境变量没有正确传递（已修复）
3. 并发上传时出现网络问题

### Q: 如何查看完整的错误堆栈？
A: 新的日志会输出完整的错误信息，包括：
- 错误代码
- HTTP状态
- 请求ID
- 错误堆栈（前1000字符）

### Q: 环境变量在API路由中可以访问，但在任务队列中不行？
A: 已修复。现在所有OSS相关函数都在运行时读取环境变量，确保始终获取最新值。

## 相关文件

- `src/server/storage.ts` - OSS上传核心逻辑（已增强日志）
- `src/server/asr-segmented.ts` - ASR分段处理（已增强日志）
- `src/app/api/debug/oss-env/route.ts` - 环境变量检查API
- `scripts/test-oss-config-quick.ts` - OSS配置测试脚本

