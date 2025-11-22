const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeProcessing() {
  try {
    const url = 'https://www.xiaoyuzhoufm.com/episode/690586de48dbe0eb56de79b4';
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 播客处理过程详细复盘');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 1. 查找任务记录
    const task = await prisma.taskQueue.findFirst({
      where: {
        AND: [
          { status: 'READY' },
          {
            OR: [
              { 'data': { path: ['url'], equals: url } },
              { 'data': { path: ['sourceUrl'], equals: url } }
            ]
          }
        ]
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    if (!task) {
      console.log('❌ 未找到已完成的任务');
      return;
    }
    
    console.log('📋 任务基本信息');
    console.log('───────────────────────────────────────────────────────────');
    console.log('任务ID:', task.id);
    console.log('创建时间:', task.createdAt.toLocaleString('zh-CN'));
    console.log('开始时间:', task.startedAt?.toLocaleString('zh-CN'));
    console.log('完成时间:', task.completedAt?.toLocaleString('zh-CN'));
    
    if (task.startedAt && task.completedAt) {
      const totalMinutes = (task.completedAt.getTime() - task.startedAt.getTime()) / 1000 / 60;
      console.log('总处理时长:', totalMinutes.toFixed(1), '分钟');
    }
    console.log('');
    
    // 2. 分析处理指标
    console.log('📊 处理指标分析');
    console.log('───────────────────────────────────────────────────────────');
    if (task.metrics) {
      const m = task.metrics;
      
      // ASR步骤
      if (m.processingSteps?.asr) {
        const asrStep = m.processingSteps.asr;
        console.log('✅ ASR转写:');
        console.log('  状态:', asrStep.status);
        if (asrStep.duration) {
          const minutes = asrStep.duration / 1000 / 60;
          console.log('  耗时:', minutes.toFixed(1), '分钟');
        }
        console.log('  ASR段落数:', m.asrSegmentsCount ?? '❌ 未记录');
      } else {
        console.log('❌ ASR步骤: 未记录');
      }
      console.log('');
      
      // 清洗步骤
      if (m.processingSteps?.cleaning) {
        const cleaningStep = m.processingSteps.cleaning;
        console.log('✅ 文本清洗:');
        console.log('  状态:', cleaningStep.status);
        if (cleaningStep.duration) {
          const seconds = cleaningStep.duration / 1000;
          console.log('  耗时:', seconds.toFixed(1), '秒');
        }
        console.log('  清洗分块数:', m.chunksCount ?? '❌ 未记录');
        console.log('  原文长度:', m.transcriptCharCount ? (m.transcriptCharCount / 1000).toFixed(1) + 'K字符' : '❌ 未记录');
        console.log('  清洗后长度:', m.optimizedCharCount ? (m.optimizedCharCount / 1000).toFixed(1) + 'K字符' : '❌ 未记录');
        console.log('  压缩比:', m.transcriptCompressionRatio ? (m.transcriptCompressionRatio * 100).toFixed(1) + '%' : '❌ 未记录');
      } else {
        console.log('❌ 清洗步骤: 未记录');
      }
      console.log('');
      
      // 报告步骤
      if (m.processingSteps?.report) {
        const reportStep = m.processingSteps.report;
        console.log('✅ 报告生成:');
        console.log('  状态:', reportStep.status);
        if (reportStep.duration) {
          const minutes = reportStep.duration / 1000 / 60;
          console.log('  耗时:', minutes.toFixed(1), '分钟');
        }
        console.log('  报告长度:', m.summaryCharCount ? (m.summaryCharCount / 1000).toFixed(1) + 'K字符' : '❌ 未记录');
        console.log('  压缩比:', m.reportCompressionRatio ? (m.reportCompressionRatio * 100).toFixed(1) + '%' : '❌ 未记录');
      } else {
        console.log('❌ 报告步骤: 未记录');
      }
      console.log('');
    }
    
    // 3. 查找播客记录
    const podcast = await prisma.podcast.findFirst({
      where: { sourceUrl: url },
      orderBy: { createdAt: 'desc' }
    });
    
    if (podcast) {
      console.log('📝 播客记录详情');
      console.log('───────────────────────────────────────────────────────────');
      console.log('播客ID:', podcast.id);
      console.log('标题:', podcast.title);
      console.log('音频时长:', podcast.duration, '秒 (' + (podcast.duration / 60).toFixed(1), '分钟)');
      console.log('');
      
      // ASR原文分析
      if (podcast.originalTranscript) {
        const asrLength = podcast.originalTranscript.length;
        console.log('📄 ASR原文:');
        console.log('  长度:', (asrLength / 1000).toFixed(1) + 'K字符');
        console.log('  前200字符:', podcast.originalTranscript.substring(0, 200).replace(/\n/g, ' '));
        console.log('');
      }
      
      // 清洗稿分析
      if (podcast.transcript) {
        const cleanedLength = podcast.transcript.length;
        const isIdentical = podcast.originalTranscript && 
                           podcast.originalTranscript === podcast.transcript;
        
        console.log('📄 清洗稿:');
        console.log('  长度:', (cleanedLength / 1000).toFixed(1) + 'K字符');
        console.log('  与ASR原文是否相同:', isIdentical ? '❌ 完全相同（清洗未生效）' : '✅ 不同（已清洗）');
        
        if (isIdentical) {
          console.log('  ⚠️  问题：清洗稿与ASR原文100%相同，清洗未生效！');
          
          // 检查语气词
          const commonFillers = ['嗯', '啊', '呃', '那个', '然后', '就是', '其实'];
          let fillerCount = 0;
          commonFillers.forEach(filler => {
            const matches = podcast.transcript.match(new RegExp(filler, 'g'));
            fillerCount += matches ? matches.length : 0;
          });
          console.log('  语气词数量:', fillerCount);
          
          if (fillerCount > 100) {
            console.log('  ⚠️  发现大量语气词，确认清洗未生效');
          }
        }
        
        console.log('  前200字符:', podcast.transcript.substring(0, 200).replace(/\n/g, ' '));
        console.log('');
      }
      
      // 总结分析
      if (podcast.summary) {
        const summaryLength = podcast.summary.length;
        const compressionRatio = podcast.transcript ? 
          (summaryLength / podcast.transcript.length * 100) : 0;
        const targetLength = podcast.transcript ? 
          (podcast.transcript.length * 0.3) : 0; // 30%目标
        
        console.log('📄 播客总结:');
        console.log('  长度:', (summaryLength / 1000).toFixed(1) + 'K字符');
        console.log('  压缩比:', compressionRatio.toFixed(1) + '%');
        console.log('  目标长度（30%）:', (targetLength / 1000).toFixed(1) + 'K字符');
        
        if (summaryLength < targetLength) {
          console.log('  ⚠️  问题：总结长度未达到目标（30%），压缩过多');
          const gap = targetLength - summaryLength;
          console.log('  差距:', (gap / 1000).toFixed(1) + 'K字符');
        }
        
        console.log('  前300字符:', podcast.summary.substring(0, 300).replace(/\n/g, ' '));
        console.log('');
      }
      
      // 问题总结
      console.log('🔍 问题诊断');
      console.log('───────────────────────────────────────────────────────────');
      const issues = [];
      
      if (podcast.transcript && podcast.originalTranscript && 
          podcast.transcript === podcast.originalTranscript) {
        issues.push('1. ❌ 清洗稿与ASR原文完全相同，清洗未生效');
      }
      
      if (podcast.summary && podcast.transcript) {
        const ratio = podcast.summary.length / podcast.transcript.length;
        if (ratio < 0.3) {
          issues.push(`2. ❌ 总结压缩比${(ratio * 100).toFixed(1)}%过低，未达到30%目标`);
        }
      }
      
      const reportDuration = task.metrics?.processingSteps?.report?.duration;
      if (reportDuration) {
        const reportMinutes = reportDuration / 1000 / 60;
        if (reportMinutes > 15) {
          issues.push(`3. ⚠️  报告生成耗时${reportMinutes.toFixed(1)}分钟，可能过长`);
        }
      }
      
      if (issues.length === 0) {
        console.log('✅ 未发现明显问题');
      } else {
        issues.forEach(issue => console.log(issue));
      }
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('复盘完成');
    console.log('═══════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('分析失败:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeProcessing();



