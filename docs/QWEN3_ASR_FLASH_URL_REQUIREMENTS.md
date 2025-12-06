# qwen3-asr-flash URL格式要求研究

## 问题描述

在使用 `qwen3-asr-flash` 模型时，所有ASR片段返回 `"url error, please check url！"` 错误，即使：
- ✅ OSS文件ACL已设置为公共读
- ✅ OSS公共URL可访问（本地测试通过）
- ✅ URL使用HTTPS协议

## 测试结果对比

### fun-asr 模型
- ✅ 可以正常访问OSS URL（包含查询参数的签名URL）
- ✅ 可以正常访问OSS公共URL（无查询参数）
- ✅ 支持并发数5

### qwen3-asr-flash 模型
- ❌ 无法访问OSS URL（包含查询参数的签名URL）
- ❌ 无法访问OSS公共URL（无查询参数）
- ❌ 所有片段返回 "url error"

## 可能的原因

根据官方文档和社区反馈，`qwen3-asr-flash` 模型对URL格式可能有以下要求：

1. **URL中不能包含查询参数**
   - 我们生成的OSS签名URL包含查询参数（`?OSSAccessKeyId=...&Expires=...&Signature=...`）
   - 这可能是导致 "url error" 的主要原因

2. **需要特定的URL格式**
   - 可能需要完整的HTTPS URL
   - 可能需要特定的域名格式

3. **权限要求**
   - 可能需要公共读权限（已设置）
   - 可能需要特定的OSS配置

## 解决方案

### 方案1：使用公共URL（无查询参数）
```typescript
// 如果bucket是公共读，直接使用公共URL
const publicUrl = `https://${OSS_BUCKET}.oss-${OSS_REGION}.aliyuncs.com/${encodeURI(path)}`;
```

### 方案2：暂时使用fun-asr模型
- fun-asr模型可以正常工作
- 支持OSS URL（包含查询参数）
- 支持公共URL（无查询参数）

### 方案3：研究qwen3-asr-flash的官方文档
- 查阅DashScope官方文档
- 咨询阿里云技术支持
- 查看社区论坛讨论

## 当前状态

- ✅ 已回退到 `fun-asr` 模型（可以正常工作）
- ✅ 并发数设置为5（fun-asr支持）
- ✅ OSS文件ACL设置为公共读（备用方案）

## 详细测试结果

### 测试1：公开HTTPS URL（非OSS，无查询参数）
- URL: `https://media.xyzcdn.net/670f3da40d2f24f28978736f/luaVbC8wX-1WxLZShoambf9-zHTY.m4a`
- 结果: ❌ 返回 "url error"
- 结论: 非OSS域名的URL不被支持

### 测试2：OSS公共URL（无查询参数）- 大文件
- URL: `https://ttxxyz.oss-cn-hangzhou.aliyuncs.com/test/qwen3-asr-flash-test-xxx.m4a`
- 文件状态: ✅ HTTP 200，可访问，Content-Type: audio/mp4
- 文件大小: 41.3MB ❌ **超过限制（10MB）**
- 音频时长: 约42分钟 ❌ **超过限制（3分钟）**
- ACL: ✅ 已设置为公共读
- 结果: ❌ 返回 "url error"
- 结论: 文件大小和时长超过限制

### 测试3：OSS公共URL（无查询参数）- 小文件
- URL: `https://ttxxyz.oss-cn-hangzhou.aliyuncs.com/test/qwen3-asr-flash-small-xxx.m4a`
- 文件状态: ✅ HTTP 200，可访问，Content-Type: audio/mp4
- 文件大小: 1.39MB ✅ **符合限制（< 10MB）**
- 音频时长: 2分钟 ✅ **符合限制（< 3分钟）**
- ACL: ✅ 已设置为公共读
- 结果: ❌ **仍然返回 "url error"**
- 结论: **即使符合文件大小和时长限制，仍然失败**

### 重要发现：文件大小和时长限制

根据官方文档，`qwen3-asr-flash` 有以下限制：
- **音频长度**：不得超过 3 分钟
- **文件大小**：不超过 10MB

我们测试的文件（41.3MB，约42分钟）远超过这些限制，这可能是导致 "url error" 的主要原因。

### 测试3：OSS签名URL（包含查询参数）
- URL: `https://ttxxyz.oss-cn-hangzhou.aliyuncs.com/test/xxx.m4a?OSSAccessKeyId=...&Expires=...&Signature=...`
- 结果: ❌ 返回 "url error"
- 结论: 签名URL也不被支持

### 可能的原因

1. **必须是阿里云OSS的URL**
   - qwen3-asr-flash可能只接受阿里云OSS的URL
   - 其他域名的URL（如media.xyzcdn.net）可能不被支持

2. **需要特定的OSS配置**
   - 可能需要OSS bucket的特定配置
   - 可能需要特定的权限设置

3. **URL格式要求**
   - 可能需要特定的URL格式（如 `https://bucket.oss-region.aliyuncs.com/path`）
   - 可能需要特定的域名格式

## 最终结论

经过全面测试，**即使符合文件大小和时长限制的小文件也失败了**：

### 文件限制（已确认）
- **音频长度**：不得超过 3 分钟
- **文件大小**：不超过 10MB

### 测试结果
- ❌ 公开HTTPS URL（非OSS）：失败
- ❌ OSS公共URL（无查询参数，大文件41.3MB）：失败
- ❌ OSS公共URL（无查询参数，小文件1.39MB，2分钟）：**仍然失败**
- ❌ OSS签名URL（包含查询参数）：失败
- ❌ 不同的API端点：失败
- ❌ 不同的参数格式（file_urls, audio_url, url）：失败

### 可能的原因

1. **qwen3-asr-flash可能不支持URL方式调用**
   - 可能需要使用base64编码方式
   - 可能需要直接上传文件内容

2. **API端点或参数格式不正确**
   - 可能使用的API端点与fun-asr不同
   - 可能需要特殊的参数格式

3. **模型可能还未正式支持URL方式**
   - 可能需要等待官方更新
   - 可能需要特殊的API密钥或权限

**结论**：即使符合所有限制条件，qwen3-asr-flash仍然无法通过URL方式调用。可能需要使用其他方式（如base64编码）或咨询阿里云技术支持。

## 下一步

1. **使用符合限制的音频文件重新测试**：
   - 文件大小 < 10MB
   - 音频时长 < 3分钟
   - 使用OSS公共URL（无查询参数）

2. **如果音频超过限制**：
   - 使用音频分割功能，将长音频分割成多个小于3分钟的片段
   - 每个片段单独调用 `qwen3-asr-flash`
   - 合并所有片段的转写结果

3. **对比fun-asr模型**：
   - `fun-asr` 没有3分钟限制，可以处理长音频
   - 如果音频超过3分钟，建议继续使用 `fun-asr`
   - 如果音频小于3分钟，可以尝试使用 `qwen3-asr-flash`

## 参考链接

- [DashScope API文档](https://help.aliyun.com/zh/model-studio/)
- [阿里云OSS文档](https://help.aliyun.com/product/31815.html)

