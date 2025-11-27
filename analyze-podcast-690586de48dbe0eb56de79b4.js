const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzePodcast() {
  try {
    const sourceUrl = 'https://www.xiaoyuzhoufm.com/episode/690586de48dbe0eb56de79b4';
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 播客处理质量与效率分析');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 查找播客记录
    const podcast = await prisma.podcast.findFirst({
      where: { sourceUrl },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!podcast) {
      console.log('❌ 未找到播客记录');
      return;
    }
    
    console.log('📊 基本信息');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`标题: ${podcast.title}`);
    console.log(`状态: ${podcast.status}`);
    console.log(`创建时间: ${podcast.createdAt}`);
    console.log(`处理开始: ${podcast.processingStartedAt || '未记录'}`);
    console.log(`处理完成: ${podcast.processingCompletedAt || '未记录'}`);
    
    if (podcast.processingStartedAt && podcast.processingCompletedAt) {
      const duration = new Date(podcast.processingCompletedAt) - new Date(podcast.processingStartedAt);
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      console.log(`总处理时长: ${minutes}分${seconds}秒 (${duration}ms)`);
    }
    console.log(`时长（秒）: ${podcast.duration || '未知'}`);
    
    // 分析文本长度
    console.log('\n📝 内容分析');
    console.log('───────────────────────────────────────────────────────────');
    const asrLength = podcast.originalTranscript?.length || 0;
    const cleanedLength = podcast.transcript?.length || 0;
    const summaryLength = podcast.summary?.length || 0;
    
    console.log(`ASR原文长度: ${asrLength.toLocaleString()} 字符`);
    console.log(`清洗稿长度: ${cleanedLength.toLocaleString()} 字符`);
    console.log(`播客总结长度: ${summaryLength.toLocaleString()} 字符`);
    
    // 计算压缩率和保留率
    if (asrLength > 0 && cleanedLength > 0) {
      const cleaningCompression = ((asrLength - cleanedLength) / asrLength * 100).toFixed(1);
      const cleaningRetention = (cleanedLength / asrLength * 100).toFixed(1);
      console.log(`\n清洗效果:`);
      console.log(`  压缩率: ${cleaningCompression}%`);
      console.log(`  保留率: ${cleaningRetention}%`);
      
      // 检查清洗是否有效
      if (Math.abs(asrLength - cleanedLength) < asrLength * 0.01) {
        console.log(`  ⚠️  警告: 清洗稿与ASR原文几乎相同（差异<1%），可能清洗未生效`);
      } else if (cleaningRetention > 95) {
        console.log(`  ✅ 清洗有效: 保留率${cleaningRetention}%，压缩了${cleaningCompression}%的语气词`);
      }
    }
    
    // 分析总结质量
    if (asrLength > 0 && summaryLength > 0) {
      const summaryRatio = (summaryLength / asrLength * 100).toFixed(2);
      console.log(`\n总结质量:`);
      console.log(`  总结/ASR比例: ${summaryRatio}%`);
      
      // 检查是否符合新要求（至少25%）
      if (parseFloat(summaryRatio) >= 25) {
        console.log(`  ✅ 符合新要求: 总结长度达到ASR原文的${summaryRatio}%（要求≥25%）`);
      } else if (parseFloat(summaryRatio) >= 15) {
        console.log(`  ⚠️  接近要求: 总结长度${summaryRatio}%，接近25%的要求`);
      } else {
        console.log(`  ❌ 未达要求: 总结长度仅${summaryRatio}%，远低于25%的要求`);
      }
      
      // 如果是146分钟播客，应该有更长的总结
      if (podcast.duration && podcast.duration > 8000) {
        const expectedMinLength = asrLength * 0.25;
        console.log(`  目标长度: ${expectedMinLength.toLocaleString()} 字符（至少25%）`);
        if (summaryLength < expectedMinLength) {
          console.log(`  ⚠️  总结偏短: 实际${summaryLength.toLocaleString()}字符 < 目标${expectedMinLength.toLocaleString()}字符`);
        }
      }
    }
    
    // 查找任务队列记录获取详细指标
    console.log('\n📈 处理指标（从任务队列）');
    console.log('───────────────────────────────────────────────────────────');
    const tasks = await prisma.taskQueue.findMany({
      where: {
        type: 'PODCAST_PROCESSING',
        data: { path: ['url'], equals: sourceUrl }
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    });
    
    if (tasks.length > 0) {
      const task = tasks[0];
      console.log(`任务状态: ${task.status}`);
      console.log(`任务ID: ${task.id}`);
      
      if (task.metrics) {
        const metrics = task.metrics;
        console.log('\n详细指标:');
        console.log(JSON.stringify(metrics, null, 2));
        
        // 分析各步骤耗时
        if (metrics.processingSteps) {
          console.log('\n⏱️  各步骤耗时:');
          const steps = metrics.processingSteps;
          
          if (steps.asr) {
            console.log(`  ASR转写: ${steps.asr.duration ? (steps.asr.duration / 1000).toFixed(1) + '秒' : '未知'} (${steps.asr.status})`);
          }
          if (steps.cleaning) {
            console.log(`  文本清洗: ${steps.cleaning.duration ? (steps.cleaning.duration / 1000).toFixed(1) + '秒' : '未知'} (${steps.cleaning.status})`);
          }
          if (steps.report) {
            console.log(`  报告生成: ${steps.report.duration ? (steps.report.duration / 1000).toFixed(1) + '秒' : '未知'} (${steps.report.status})`);
          }
        }
        
        // 分析分块信息
        if (metrics.chunksCount) {
          console.log(`\n分块信息:`);
          console.log(`  清洗块数: ${metrics.chunksCount}`);
          console.log(`  ASR片段数: 约${Math.floor(podcast.duration / 120) || '未知'}`);
        }
      }
    }
    
    // 检查ASR和清洗稿内容相似度（简单检查）
    if (podcast.originalTranscript && podcast.transcript) {
      console.log('\n🔍 清洗质量检查');
      console.log('───────────────────────────────────────────────────────────');
      
      // 检查前1000字符是否相同
      const asrPreview = podcast.originalTranscript.substring(0, 1000);
      const cleanedPreview = podcast.transcript.substring(0, 1000);
      
      if (asrPreview === cleanedPreview) {
        console.log('  ⚠️  警告: 清洗稿前1000字符与ASR原文完全相同，可能清洗未生效');
      } else {
        console.log('  ✅ 清洗稿与ASR原文有差异，清洗可能生效');
      }
      
      // 统计常见语气词
      const fillers = ['嗯', '啊', '呃', '那个', '然后', '就是', '其实'];
      console.log('\n语气词统计（前5000字符）:');
      const asrSample = podcast.originalTranscript.substring(0, 5000);
      const cleanedSample = podcast.transcript.substring(0, 5000);
      
      fillers.forEach(filler => {
        const asrCount = (asrSample.match(new RegExp(filler, 'g')) || []).length;
        const cleanedCount = (cleanedSample.match(new RegExp(filler, 'g')) || []).length;
        if (asrCount > 0 || cleanedCount > 0) {
          console.log(`  "${filler}": ASR原文${asrCount}次 → 清洗稿${cleanedCount}次 ${asrCount > cleanedCount ? '✅' : '⚠️'}`);
        }
      });
    }
    
    // 总结评价
    console.log('\n🎯 综合评价');
    console.log('───────────────────────────────────────────────────────────');
    
    const issues = [];
    const strengths = [];
    
    // 检查清洗效果
    if (asrLength > 0 && cleanedLength > 0) {
      if (Math.abs(asrLength - cleanedLength) < asrLength * 0.01) {
        issues.push('清洗稿与ASR原文几乎相同，清洗可能未生效');
      } else {
        strengths.push(`清洗有效：压缩了${((asrLength - cleanedLength) / asrLength * 100).toFixed(1)}%`);
      }
    }
    
    // 检查总结长度
    if (asrLength > 0 && summaryLength > 0) {
      const ratio = summaryLength / asrLength * 100;
      if (ratio >= 25) {
        strengths.push(`总结长度达标：${ratio.toFixed(1)}%（要求≥25%）`);
      } else {
        issues.push(`总结长度不足：仅${ratio.toFixed(1)}%，未达到25%要求`);
      }
    }
    
    // 检查处理时长
    if (podcast.processingStartedAt && podcast.processingCompletedAt) {
      const duration = new Date(podcast.processingCompletedAt) - new Date(podcast.processingStartedAt);
      const minutes = duration / 60000;
      if (minutes > 30) {
        issues.push(`处理时长较长：${minutes.toFixed(1)}分钟`);
      } else if (minutes < 20) {
        strengths.push(`处理效率高：${minutes.toFixed(1)}分钟`);
      }
    }
    
    if (strengths.length > 0) {
      console.log('\n✅ 优势:');
      strengths.forEach(s => console.log(`  • ${s}`));
    }
    
    if (issues.length > 0) {
      console.log('\n⚠️  需要改进:');
      issues.forEach(i => console.log(`  • ${i}`));
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('分析失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzePodcast();




