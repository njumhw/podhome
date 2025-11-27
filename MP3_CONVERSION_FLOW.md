# MP3转M4A处理流程

## 整体流程概览

```
播客URL (小宇宙等)
    ↓
解析器提取音频URL (可能是MP3或M4A)
    ↓
格式检测 (detectAudioFormat)
    ↓
下载音频文件到临时目录
    ↓
[如果是MP3] → FFmpeg转换为M4A → 删除原始MP3
    ↓
[如果是M4A] → 直接使用
    ↓
ASR转写处理 (使用M4A格式)
    ↓
后续处理流程 (清洗、总结等)
```

## 详细步骤

### 1. 格式检测 (`detectAudioFormat`)

**位置**: `src/server/audio-converter.ts`

**逻辑**:
- 检查URL中是否包含 `.mp3` 或 `.m4a`
- 解析URL路径，检查扩展名
- 返回: `'mp3'` | `'m4a'` | `'unknown'`

**示例**:
```typescript
detectAudioFormat('https://media.xyzcdn.net/xxx.mp3') // → 'mp3'
detectAudioFormat('https://media.xyzcdn.net/xxx.m4a') // → 'm4a'
```

### 2. 音频下载 (`downloadWholeToTemp`)

**位置**: `src/server/asr-segmented.ts`

**流程**:
1. 检测音频格式
2. 根据格式确定临时文件扩展名 (`.mp3` 或 `.m4a`)
3. 下载音频文件到临时目录
4. 验证文件大小

**关键代码**:
```typescript
const format = detectAudioFormat(sourceUrl);
const originalExt = format === 'mp3' ? '.mp3' : '.m4a';
const tmpFile = path.join(tmp, `src-${timestamp}-${random}${originalExt}`);
```

### 3. MP3转M4A转换 (`convertMp3ToM4a`)

**位置**: `src/server/audio-converter.ts`

**转换参数**:
- 输入: MP3文件
- 输出: M4A文件 (AAC编码)
- 编码参数:
  - 编码器: AAC (`-acodec aac`)
  - 比特率: 128kbps (`-b:a 128k`)
  - 采样率: 44.1kHz (`-ar 44100`)
  - 声道: 立体声 (`-ac 2`)
  - 优化: 流媒体播放 (`-movflags +faststart`)

**验证步骤**:
1. 验证输入文件存在且大小 > 0
2. 验证输入文件头 (检查是否为有效MP3)
3. 执行FFmpeg转换
4. 验证输出文件存在且大小合理 (至少为输入的30%)
5. 记录转换耗时和文件大小

**错误处理**:
- 转换失败时抛出错误 (不再回退到原始MP3)
- 自动清理不完整的转换文件
- 记录详细的FFmpeg错误信息

### 4. 文件清理

**流程**:
1. 转换成功后，删除原始MP3文件
2. 转换失败时，清理不完整的转换文件
3. 临时文件在ASR处理完成后自动清理

### 5. ASR处理

**位置**: `src/server/asr-segmented.ts`

**流程**:
1. 使用转换后的M4A文件 (或原始M4A文件)
2. 使用FFmpeg切割音频片段 (120秒/段)
3. 上传片段到OSS
4. 调用ASR API转写
5. 合并转写结果

**关键点**:
- `cutOne` 函数始终输出M4A格式
- 所有音频片段都使用AAC编码
- 确保格式一致性

## 实现位置

### 核心文件

1. **`src/server/audio-converter.ts`**
   - `detectAudioFormat()`: 格式检测
   - `convertMp3ToM4a()`: MP3转M4A转换
   - `downloadAndConvertToM4a()`: 下载并转换 (备用)

2. **`src/server/asr-segmented.ts`**
   - `downloadWholeToTemp()`: 下载音频并自动转换
   - `transcribeAudioWithSegmentation()`: ASR转写主函数

3. **`src/app/api/asr/route.ts`**
   - 也集成了MP3转M4A功能 (用于直接ASR调用)

4. **`src/app/api/resolve-audio/route.ts`**
   - 使用 `detectAudioFormat` 返回格式信息

## 日志输出

### 格式检测
```
[音频下载] 检测到音频格式: mp3, URL: https://...
```

### 转换过程
```
[音频转换] 检测到MP3格式，开始转换为M4A...
[音频转换] 输入文件: /tmp/podroom/src-xxx.mp3, 大小: 12345678 字节
[音频转换] 输入文件大小: 11.77MB
[音频转换] ✅ 输入文件验证通过，确认为MP3格式
[音频转换] 开始转换MP3到M4A: /tmp/podroom/src-xxx.mp3 -> /tmp/podroom/converted-xxx.m4a
[音频转换] ✅ 转换成功，耗时: 15.3秒，输出文件大小: 10.45MB
[音频转换] ✅ MP3已转换为M4A: /tmp/podroom/converted-xxx.m4a, 大小: 10956800 字节
[音频转换] 已删除原始MP3文件: /tmp/podroom/src-xxx.mp3
```

### ASR处理
```
[ASR分段] 开始下载音频: https://...
[ASR分段] 检测到音频格式: mp3
[ASR分段] 音频下载完成: /tmp/podroom/converted-xxx.m4a, 大小: 10.45MB
[ASR分段] ✅ 文件格式验证通过: .m4a
```

## 错误处理

### 转换失败
- **行为**: 抛出错误，不继续处理
- **原因**: 后续ASR处理需要M4A格式，不能使用MP3
- **清理**: 自动清理不完整的转换文件

### 下载失败
- **行为**: 重试3次，尝试多种下载策略
- **策略**: 代理下载 → 直接下载 (或相反)

### 文件验证失败
- **输入文件**: 检查存在性、大小、文件头
- **输出文件**: 检查存在性、大小、合理性

## 性能考虑

1. **转换耗时**: 取决于文件大小，通常为文件时长的10-20%
2. **存储空间**: 转换后的M4A文件通常比MP3小10-20%
3. **临时文件**: 自动清理，不占用长期存储

## 兼容性

- ✅ 支持所有MP3格式 (ID3标签、无标签)
- ✅ 支持所有M4A格式
- ✅ 自动检测格式，无需手动配置
- ✅ 转换失败时提供详细错误信息

