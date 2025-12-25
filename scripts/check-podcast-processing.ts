import { db } from '../src/server/db';

/**
 * 检查播客处理情况
 * 用法: pnpm tsx scripts/check-podcast-processing.ts <podcastId或sourceUrl>
 */

async function checkPodcastProcessing(identifier: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 检查播客处理情况');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. 查找播客记录
  let podcast: any = null;
  
  // 尝试通过 ID 查找
  if (identifier.length === 24) {
    podcast = await db.podcast.findUnique({
      where: { id: identifier },
      include: {
        topic: true,
      },
    });
  }
  
  // 如果通过 ID 找不到，尝试通过 sourceUrl 查找
  if (!podcast) {
    podcast = await db.podcast.findFirst({
      where: {
        OR: [
          { sourceUrl: identifier },
          { sourceUrl: { contains: identifier } },
        ],
      },
      include: {
        topic: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  if (!podcast) {
    console.error('❌ 未找到播客记录');
    console.log(`尝试查找: ${identifier}`);
    return;
  }

  console.log('📋 播客基本信息:');
  console.log(`  ID: ${podcast.id}`);
  console.log(`  标题: ${podcast.title}`);
  console.log(`  作者: ${podcast.showAuthor || '未知'}`);
  console.log(`  状态: ${podcast.status}`);
  console.log(`  来源URL: ${podcast.sourceUrl?.substring(0, 100)}...`);
  console.log(`  音频URL: ${podcast.audioUrl?.substring(0, 100)}...`);
  console.log(`  创建时间: ${podcast.createdAt}`);
  console.log(`  更新时间: ${podcast.updatedAt}`);
  console.log(`  处理开始时间: ${podcast.processingStartedAt || '未记录'}`);
  console.log(`  处理完成时间: ${podcast.processingCompletedAt || '未记录'}`);
  
  if (podcast.processingStartedAt && podcast.processingCompletedAt) {
    const duration = new Date(podcast.processingCompletedAt).getTime() - new Date(podcast.processingStartedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    console.log(`  总处理时长: ${minutes}分${seconds}秒 (${duration}ms)`);
  }

  console.log('\n📝 内容字段:');
  console.log(`  原始转写 (originalTranscript): ${podcast.originalTranscript ? `${podcast.originalTranscript.length} 字符` : '无'}`);
  console.log(`  转写 (transcript): ${podcast.transcript ? `${podcast.transcript.length} 字符` : '无'}`);
  console.log(`  翻译转写 (translatedTranscript): ${podcast.translatedTranscript ? `${podcast.translatedTranscript.length} 字符` : '无'}`);
  console.log(`  总结 (summary): ${podcast.summary ? `${podcast.summary.length} 字符` : '无'}`);
  console.log(`  翻译总结 (translatedSummary): ${podcast.translatedSummary ? `${podcast.translatedSummary.length} 字符` : '无'}`);

  // 检查内容语言
  if (podcast.originalTranscript) {
    const sample = podcast.originalTranscript.substring(0, 500);
    const englishWords = (sample.match(/\b(the|and|is|are|was|were|this|that|with|from|have|has|been|will|would|could|should|may|might|can|must|do|does|did|not|no|yes|you|we|they|he|she|it|I|me|my|your|our|their|his|her|its)\b/gi) || []).length;
    const chineseChars = (sample.match(/[\u4e00-\u9fa5]/g) || []).length;
    console.log(`\n🔤 原始转写语言分析:`);
    console.log(`  英文单词数: ${englishWords}`);
    console.log(`  中文字符数: ${chineseChars}`);
    console.log(`  判断: ${englishWords > 10 && chineseChars < 5 ? '英文' : chineseChars > 10 ? '中文' : '未知'}`);
  }

  if (podcast.summary) {
    const sample = podcast.summary.substring(0, 500);
    const englishWords = (sample.match(/\b(the|and|is|are|was|were|this|that|with|from|have|has|been|will|would|could|should|may|might|can|must|do|does|did|not|no|yes|you|we|they|he|she|it|I|me|my|your|our|their|his|her|its)\b/gi) || []).length;
    const chineseChars = (sample.match(/[\u4e00-\u9fa5]/g) || []).length;
    console.log(`\n🔤 总结语言分析:`);
    console.log(`  英文单词数: ${englishWords}`);
    console.log(`  中文字符数: ${chineseChars}`);
    console.log(`  判断: ${englishWords > 10 && chineseChars < 5 ? '英文' : chineseChars > 10 ? '中文' : '未知'}`);
  }

  // 2. 查找任务队列记录
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 任务队列记录');
  console.log('═══════════════════════════════════════════════════════════\n');

  const tasks = await db.taskQueue.findMany({
    where: {
      podcastId: podcast.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  if (tasks.length === 0) {
    console.log('⚠️ 未找到任务队列记录');
  } else {
    console.log(`找到 ${tasks.length} 条任务记录:\n`);
    for (const task of tasks) {
      console.log(`任务 ID: ${task.id}`);
      console.log(`  状态: ${task.status}`);
      console.log(`  创建时间: ${task.createdAt}`);
      console.log(`  开始时间: ${task.startedAt || '未开始'}`);
      console.log(`  完成时间: ${task.completedAt || '未完成'}`);
      
      if (task.startedAt && task.completedAt) {
        const duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        console.log(`  处理时长: ${minutes}分${seconds}秒 (${duration}ms)`);
      }
      
      if (task.metrics) {
        const metrics = task.metrics as any;
        console.log(`  指标:`);
        if (metrics.processingSteps) {
          console.log(`    处理步骤:`);
          for (const [step, data] of Object.entries(metrics.processingSteps as any)) {
            const stepData = data as any;
            if (stepData.duration) {
              console.log(`      ${step}: ${(stepData.duration / 1000).toFixed(1)}秒`);
            }
          }
        }
        if (metrics.audioDuration) {
          console.log(`    音频时长: ${metrics.audioDuration}秒`);
        }
      }
      console.log('');
    }
  }

  // 3. 查找任务日志
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📝 任务日志记录');
  console.log('═══════════════════════════════════════════════════════════\n');

  const taskLogs = await db.taskLog.findMany({
    where: {
      podcastId: podcast.id,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (taskLogs.length === 0) {
    console.log('⚠️ 未找到任务日志记录');
  } else {
    console.log(`找到 ${taskLogs.length} 条日志记录:\n`);
    
    // 按类型分组
    const logsByType = new Map<string, any[]>();
    for (const log of taskLogs) {
      if (!logsByType.has(log.type)) {
        logsByType.set(log.type, []);
      }
      logsByType.get(log.type)!.push(log);
    }

    for (const [type, logs] of logsByType) {
      console.log(`\n${type}:`);
      const firstLog = logs[0];
      const lastLog = logs[logs.length - 1];
      
      if (firstLog.createdAt && lastLog.createdAt) {
        const duration = new Date(lastLog.createdAt).getTime() - new Date(firstLog.createdAt).getTime();
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        console.log(`  开始时间: ${firstLog.createdAt}`);
        console.log(`  结束时间: ${lastLog.createdAt}`);
        console.log(`  耗时: ${minutes}分${seconds}秒 (${duration}ms)`);
        console.log(`  日志条数: ${logs.length}`);
      }
      
      // 显示最后一条日志的消息
      if (lastLog.message) {
        console.log(`  最后消息: ${lastLog.message.substring(0, 200)}...`);
      }
    }
  }

  // 4. 检查 AudioCache
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('💾 音频缓存记录');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (podcast.audioUrl) {
    const audioCache = await db.audioCache.findUnique({
      where: { audioUrl: podcast.audioUrl },
    });

    if (audioCache) {
      console.log('✅ 找到音频缓存记录');
      console.log(`  转写长度: ${audioCache.transcript ? `${audioCache.transcript.length} 字符` : '无'}`);
      console.log(`  总结长度: ${audioCache.summary ? `${audioCache.summary.length} 字符` : '无'}`);
      console.log(`  翻译转写长度: ${audioCache.translatedTranscript ? `${audioCache.translatedTranscript.length} 字符` : '无'}`);
      console.log(`  翻译总结长度: ${audioCache.translatedSummary ? `${audioCache.translatedSummary.length} 字符` : '无'}`);
    } else {
      console.log('⚠️ 未找到音频缓存记录');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ 检查完成');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// 从命令行参数获取标识符
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ 请提供播客 ID 或 sourceUrl');
  console.log('用法: pnpm tsx scripts/check-podcast-processing.ts <podcastId或sourceUrl>');
  process.exit(1);
}

checkPodcastProcessing(identifier)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  });

