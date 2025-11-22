const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function diagnoseCleaningFailure() {
  try {
    const url = 'https://www.xiaoyuzhoufm.com/episode/690586de48dbe0eb56de79b4';
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 清洗失败原因诊断');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 1. 查找播客记录
    const podcast = await prisma.podcast.findFirst({
      where: { sourceUrl: url },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!podcast) {
      console.log('❌ 未找到播客记录');
      return;
    }
    
    console.log('📋 播客基本信息');
    console.log('───────────────────────────────────────────────────────────');
    console.log('播客ID:', podcast.id);
    console.log('音频时长:', podcast.duration, '秒 (' + (podcast.duration / 60).toFixed(1), '分钟)');
    console.log('');
    
    // 2. 分析ASR原文
    console.log('📄 ASR原文分析');
    console.log('───────────────────────────────────────────────────────────');
    if (podcast.originalTranscript) {
      const asrText = podcast.originalTranscript;
      console.log('ASR原文长度:', asrText.length, '字符');
      
      // 按段落分割（ASR转写通常以\n\n分隔）
      const paragraphs = asrText.split('\n\n').filter(p => p.trim());
      console.log('段落数:', paragraphs.length);
      
      // 估算ASR片段数（146分钟，120秒/片段 = 约73个片段）
      const expectedSegments = Math.ceil(podcast.duration / 120);
      console.log('预期ASR片段数（120秒/片段）:', expectedSegments);
      
      // 如果段落数接近预期片段数，说明ASR可能正确分段了
      if (paragraphs.length >= expectedSegments * 0.8) {
        console.log('✅ ASR可能已正确分段');
        console.log('   前3个段落长度:', paragraphs.slice(0, 3).map(p => p.length + '字符'));
      } else {
        console.log('⚠️ 段落数远少于预期片段数，ASR可能未正确分段');
      }
      
      // 检查是否有说话人标签
      const hasSpeakerLabels = paragraphs.some(p => /^[A-Z][a-z]+:|^Speaker\d+:|^- \*\*/.test(p));
      console.log('是否包含说话人标签:', hasSpeakerLabels ? '是' : '否');
      if (hasSpeakerLabels) {
        const sampleLabels = paragraphs.filter(p => /^[A-Z][a-z]+:|^Speaker\d+:|^- \*\*/.test(p)).slice(0, 3);
        console.log('说话人标签示例:', sampleLabels.map(p => p.substring(0, 50)));
      }
      console.log('');
    }
    
    // 3. 检查清洗稿
    console.log('📄 清洗稿分析');
    console.log('───────────────────────────────────────────────────────────');
    if (podcast.transcript) {
      const isIdentical = podcast.originalTranscript === podcast.transcript;
      console.log('清洗稿长度:', podcast.transcript.length, '字符');
      console.log('与ASR原文是否相同:', isIdentical ? '❌ 完全相同（清洗未生效）' : '✅ 不同（已清洗）');
      
      if (isIdentical) {
        console.log('\n🔍 深度分析清洗失败原因：');
        console.log('───────────────────────────────────────────────────────────');
        
        // 检查语气词
        const commonFillers = ['嗯', '啊', '呃', '那个', '然后', '就是', '其实', '你知道吧', '我觉得吧', '对吧', '所以说', '我感觉', '这样子', '这个', '那个时候', '怎么说呢'];
        let fillerCount = 0;
        const fillerDetails = {};
        commonFillers.forEach(filler => {
          const matches = podcast.transcript.match(new RegExp(filler, 'g'));
          if (matches) {
            fillerDetails[filler] = matches.length;
            fillerCount += matches.length;
          }
        });
        
        console.log('语气词总数:', fillerCount);
        console.log('语气词分布（前10）:', 
          Object.entries(fillerDetails)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => `${word}:${count}`)
            .join(', ')
        );
        
        console.log('\n📊 可能的原因：');
        console.log('───────────────────────────────────────────────────────────');
        
        // 原因1: 清洗函数抛出异常，但被catch了
        console.log('1. ✅ 最可能：清洗函数检测到清洗失败（第111行抛出异常）');
        console.log('   - cleanTranscriptWithABCDE在第111行检查到语气词数量相同');
        console.log('   - 抛出异常："清洗失败：最终结果与ASR原文完全相同"');
        console.log('   - audio-processor.ts第159行catch了这个异常');
        console.log('   - 触发容错机制，使用ASR原文作为清洗稿');
        console.log('   - 导致清洗稿 = ASR原文');
        
        // 原因2: ASR segments为空
        const expectedSegments = Math.ceil(podcast.duration / 120);
        console.log('\n2. ⚠️  可能：ASR segments为空或未正确传递');
        console.log('   - 如果asrResult.speakers为空数组');
        console.log('   - 则asrData.segments也为空数组');
        console.log('   - segmentTexts会是空数组');
        console.log('   - 清洗函数会使用createABCDEChunks(transcript)而不是createABCDEChunksFromSegments');
        console.log('   - 预期ASR片段数:', expectedSegments);
        
        // 原因3: LLM返回了原文
        console.log('\n3. ⚠️  可能：LLM清洗过程中返回了原文');
        console.log('   - 清洗函数调用了LLM，但LLM返回了未清洗的原文');
        console.log('   - 导致最终结果与ASR原文完全相同');
        console.log('   - 但这应该被第111行的检查捕获并抛出异常');
        
        console.log('\n💡 建议的解决方案：');
        console.log('───────────────────────────────────────────────────────────');
        console.log('1. 检查服务器日志，确认是否有"文本清洗失败"的警告');
        console.log('2. 检查是否有"清洗失败：最终结果与ASR原文完全相同"的错误');
        console.log('3. 检查ASR返回的speakers数组是否为空');
        console.log('4. 如果异常被捕获，应该记录更详细的错误信息');
        console.log('5. 不应该让清洗失败后还继续使用ASR原文，应该真正失败并报告');
      }
      console.log('');
    }
    
    // 4. 查找任务记录，检查指标
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
    
    if (task && task.metrics) {
      console.log('📊 任务指标分析');
      console.log('───────────────────────────────────────────────────────────');
      const m = task.metrics;
      console.log('ASR段落数:', m.asrSegmentsCount ?? '❌ 未记录');
      console.log('清洗分块数:', m.chunksCount ?? '❌ 未记录');
      
      if (m.asrSegmentsCount === 0) {
        console.log('\n⚠️  关键发现：ASR段落数为0！');
        console.log('   - 这说明asrResult.speakers可能是空数组');
        console.log('   - 或者asrData.segments没有被正确创建');
        console.log('   - 这会导致segmentTexts为空数组');
        console.log('   - 清洗函数会使用transcript而不是segments进行分块');
      }
      
      if (m.chunksCount === 0) {
        console.log('\n⚠️  关键发现：清洗分块数为0！');
        console.log('   - 这说明清洗可能根本没有执行');
        console.log('   - 或者清洗失败后被容错机制替换了');
      }
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('诊断完成');
    console.log('═══════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('诊断失败:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseCleaningFailure();



