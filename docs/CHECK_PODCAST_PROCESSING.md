# 检查播客处理情况

## 在服务器上执行

### 方法 1: 使用检查脚本（推荐）

```bash
cd /opt/podroom

# 通过播客 ID 检查
pnpm tsx scripts/check-podcast-details.ts cmjkakohk0004lyzsk2ro6mx1

# 或通过 sourceUrl 检查
pnpm tsx scripts/check-podcast-details.ts "https://podcasts.apple.com/cn/podcast/rip-to-rpa-how-ai-makes-operations-work/id842818711?i=1000684998160"
```

### 方法 2: 直接查询数据库

```bash
cd /opt/podroom

# 1. 查询播客基本信息
pnpm tsx -e "
import { db } from './src/server/db';

async function check() {
  const podcast = await db.podcast.findUnique({
    where: { id: 'cmjkakohk0004lyzsk2ro6mx1' },
  });
  
  if (!podcast) {
    console.log('未找到播客');
    process.exit(1);
  }
  
  console.log('播客信息:');
  console.log('  ID:', podcast.id);
  console.log('  标题:', podcast.title);
  console.log('  状态:', podcast.status);
  console.log('  处理开始:', podcast.processingStartedAt);
  console.log('  处理完成:', podcast.processingCompletedAt);
  
  if (podcast.processingStartedAt && podcast.processingCompletedAt) {
    const duration = new Date(podcast.processingCompletedAt).getTime() - new Date(podcast.processingStartedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    console.log('  总处理时长:', hours + '小时' + remainingMinutes + '分' + seconds + '秒');
  }
  
  console.log('');
  console.log('内容字段:');
  console.log('  originalTranscript:', podcast.originalTranscript ? podcast.originalTranscript.length + ' 字符' : '无');
  console.log('  transcript:', podcast.transcript ? podcast.transcript.length + ' 字符' : '无');
  console.log('  translatedTranscript:', podcast.translatedTranscript ? podcast.translatedTranscript.length + ' 字符' : '无');
  console.log('  summary:', podcast.summary ? podcast.summary.length + ' 字符' : '无');
  console.log('  translatedSummary:', podcast.translatedSummary ? podcast.translatedSummary.length + ' 字符' : '无');
  
  // 检查总结语言
  if (podcast.summary) {
    const sample = podcast.summary.substring(0, 500);
    const englishWords = (sample.match(/\\b(the|and|is|are|was|were|this|that|with|from|have|has|been|will|would|could|should|may|might|can|must|do|does|did|not|no|yes|you|we|they|he|she|it|I|me|my|your|our|their|his|her|its)\\b/gi) || []).length;
    const chineseChars = (sample.match(/[\\u4e00-\\u9fa5]/g) || []).length;
    console.log('');
    console.log('总结语言分析:');
    console.log('  英文单词数:', englishWords);
    console.log('  中文字符数:', chineseChars);
    console.log('  判断:', englishWords > 10 && chineseChars < 5 ? '英文' : chineseChars > 10 ? '中文' : '未知');
    
    // 显示总结预览
    console.log('');
    console.log('总结预览（前500字符）:');
    console.log(podcast.summary.substring(0, 500));
  }
  
  // 检查原始转写语言
  if (podcast.originalTranscript) {
    const sample = podcast.originalTranscript.substring(0, 500);
    const englishWords = (sample.match(/\\b(the|and|is|are|was|were|this|that|with|from|have|has|been|will|would|could|should|may|might|can|must|do|does|did|not|no|yes|you|we|they|he|she|it|I|me|my|your|our|their|his|her|its)\\b/gi) || []).length;
    const chineseChars = (sample.match(/[\\u4e00-\\u9fa5]/g) || []).length;
    console.log('');
    console.log('原始转写语言分析:');
    console.log('  英文单词数:', englishWords);
    console.log('  中文字符数:', chineseChars);
    console.log('  判断:', englishWords > 10 && chineseChars < 5 ? '英文' : chineseChars > 10 ? '中文' : '未知');
  }
  
  process.exit(0);
}

check().catch(console.error);
"

# 2. 查询任务队列记录
pnpm tsx -e "
import { db } from './src/server/db';

async function check() {
  // 先找到所有包含这个 URL 的任务
  const allTasks = await db.taskQueue.findMany({
    where: {
      type: 'PODCAST_PROCESSING',
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 最近7天
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  
  const targetUrl = 'https://podcasts.apple.com/cn/podcast/rip-to-rpa-how-ai-makes-operations-work/id842818711?i=1000684998160';
  const matchingTasks = allTasks.filter(t => {
    const data = t.data as any;
    return data?.url === targetUrl || data?.url?.includes('rip-to-rpa');
  });
  
  console.log('找到', matchingTasks.length, '个相关任务:');
  for (const task of matchingTasks) {
    console.log('');
    console.log('任务 ID:', task.id);
    console.log('  状态:', task.status);
    console.log('  创建时间:', task.createdAt);
    console.log('  开始时间:', task.startedAt || '未开始');
    console.log('  完成时间:', task.completedAt || '未完成');
    
    if (task.startedAt && task.completedAt) {
      const duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      console.log('  处理时长:', hours + '小时' + remainingMinutes + '分' + seconds + '秒');
    }
    
    if (task.metrics) {
      const metrics = task.metrics as any;
      if (metrics.processingSteps) {
        console.log('  处理步骤:');
        for (const [step, data] of Object.entries(metrics.processingSteps)) {
          const stepData = data as any;
          if (stepData.duration) {
            const stepMinutes = Math.floor(stepData.duration / 60000);
            const stepSeconds = Math.floor((stepData.duration % 60000) / 1000);
            console.log('    ' + step + ':', stepMinutes + '分' + stepSeconds + '秒');
          }
        }
      }
    }
  }
  
  process.exit(0);
}

check().catch(console.error);
"

# 3. 查询任务日志
pnpm tsx -e "
import { db } from './src/server/db';

async function check() {
  const logs = await db.taskLog.findMany({
    where: { podcastId: 'cmjkakohk0004lyzsk2ro6mx1' },
    orderBy: { createdAt: 'asc' },
  });
  
  console.log('找到', logs.length, '条日志记录');
  
  const logsByType = new Map();
  for (const log of logs) {
    if (!logsByType.has(log.type)) {
      logsByType.set(log.type, []);
    }
    logsByType.get(log.type).push(log);
  }
  
  for (const [type, typeLogs] of logsByType) {
    const firstLog = typeLogs[0];
    const lastLog = typeLogs[typeLogs.length - 1];
    
    if (firstLog.createdAt && lastLog.createdAt) {
      const duration = new Date(lastLog.createdAt).getTime() - new Date(firstLog.createdAt).getTime();
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      console.log('');
      console.log(type + ':');
      console.log('  开始:', firstLog.createdAt);
      console.log('  结束:', lastLog.createdAt);
      console.log('  耗时:', hours + '小时' + remainingMinutes + '分' + seconds + '秒');
      console.log('  日志数:', typeLogs.length);
      console.log('  最终状态:', lastLog.status);
    }
  }
  
  process.exit(0);
}

check().catch(console.error);
"
```

## 检查内容

脚本会检查以下内容：

1. **播客基本信息**
   - ID、标题、状态
   - 处理开始/完成时间
   - 总处理时长

2. **内容字段**
   - `originalTranscript`（原始转写）
   - `transcript`（转写）
   - `translatedTranscript`（翻译转写）
   - `summary`（总结）
   - `translatedSummary`（翻译总结）
   - 语言分析（英文/中文判断）

3. **任务队列记录**
   - 任务状态
   - 处理时长
   - 各步骤耗时（ASR、报告生成等）

4. **任务日志**
   - 各步骤的开始/结束时间
   - 各步骤的耗时
   - 最终状态

5. **音频缓存**
   - 缓存中的内容

## 预期输出

脚本会显示：
- ✅ 是否有英文总结（`summary` 字段）
- ✅ 是否有中文翻译（`translatedSummary` 字段）
- ✅ 各处理步骤的耗时
- ✅ 总处理时长

