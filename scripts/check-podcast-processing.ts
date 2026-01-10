import { db } from '../src/server/db';

async function checkPodcastProcessing() {
  const podcastId = process.argv[2] || 'cmk7saf8n0004lyj4f58ne5sk';
  
  console.log(`\n=== 分析播客 ${podcastId} 的处理过程 ===\n`);
  
  const podcast = await db.podcast.findUnique({
    where: { id: podcastId },
    select: {
      id: true,
      title: true,
      originalTranscript: true,
      summary: true,
      translatedSummary: true,
      translatedTranscript: true,
      status: true,
      processingStartedAt: true,
      processingCompletedAt: true,
    }
  });
  
  if (!podcast) {
    console.log('❌ 播客不存在');
    await db.$disconnect();
    return;
  }
  
  // 分析 ASR 语言
  if (podcast.originalTranscript) {
    const transcript = podcast.originalTranscript;
    const chineseCharCount = (transcript.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishCharCount = (transcript.match(/[a-zA-Z]/g) || []).length;
    const totalChars = transcript.length;
    const chineseRatio = (chineseCharCount / totalChars) * 100;
    const englishRatio = (englishCharCount / totalChars) * 100;
    
    console.log('📊 ASR 原文分析:');
    console.log(`   总字符数: ${totalChars.toLocaleString()}`);
    console.log(`   中文字符: ${chineseCharCount.toLocaleString()} (${chineseRatio.toFixed(1)}%)`);
    console.log(`   英文字符: ${englishCharCount.toLocaleString()} (${englishRatio.toFixed(1)}%)`);
    
    const isChinese = chineseRatio > 50;
    const isEnglish = englishRatio > 50;
    
    if (isChinese) {
      console.log(`   ✅ 检测为中文播客`);
    } else if (isEnglish) {
      console.log(`   ✅ 检测为英文播客`);
    } else {
      console.log(`   ⚠️ 混合语言或无法确定`);
    }
    
    console.log(`\n   ASR 原文前500字符:`);
    console.log(`   ${transcript.substring(0, 500)}...`);
  }
  
  // 分析总结
  if (podcast.summary) {
    console.log(`\n📝 总结分析:`);
    console.log(`   长度: ${podcast.summary.length.toLocaleString()} 字符`);
    
    const summaryChinesCharCount = (podcast.summary.match(/[\u4e00-\u9fa5]/g) || []).length;
    const summaryEnglishCharCount = (podcast.summary.match(/[a-zA-Z]/g) || []).length;
    const summaryTotalChars = podcast.summary.length;
    const summaryChineseRatio = (summaryChinesCharCount / summaryTotalChars) * 100;
    const summaryEnglishRatio = (summaryEnglishCharCount / summaryTotalChars) * 100;
    
    console.log(`   中文字符: ${summaryChinesCharCount.toLocaleString()} (${summaryChineseRatio.toFixed(1)}%)`);
    console.log(`   英文字符: ${summaryEnglishCharCount.toLocaleString()} (${summaryEnglishRatio.toFixed(1)}%)`);
    
    console.log(`\n   总结前500字符:`);
    console.log(`   ${podcast.summary.substring(0, 500)}...`);
    
    // 检查是否包含报告概述
    if (podcast.summary.includes('报告概述') || podcast.summary.includes('Executive Summary') || podcast.summary.includes('内容提要')) {
      console.log(`   ✅ 包含报告概述部分`);
    }
  }
  
  // 处理时间分析
  if (podcast.processingStartedAt && podcast.processingCompletedAt) {
    const duration = podcast.processingCompletedAt.getTime() - podcast.processingStartedAt.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    console.log(`\n⏱️ 处理时间:`);
    console.log(`   开始时间: ${podcast.processingStartedAt.toLocaleString('zh-CN')}`);
    console.log(`   完成时间: ${podcast.processingCompletedAt.toLocaleString('zh-CN')}`);
    console.log(`   总耗时: ${minutes}分${seconds}秒`);
    
    // 估算各步骤耗时（基于经验值）
    console.log(`\n   估算步骤耗时（基于经验值）:`);
    console.log(`   - ASR转写: ~30-60秒`);
    console.log(`   - 文本清洗: ~5-10秒`);
    console.log(`   - 说话人识别: ~10-20秒`);
    console.log(`   - 报告生成: ~${Math.max(60, duration - 90000) / 1000}秒（剩余时间）`);
  }
  
  // 检查处理结果
  console.log(`\n✅ 处理结果检查:`);
  console.log(`   状态: ${podcast.status}`);
  console.log(`   ASR原文: ${podcast.originalTranscript ? '✅' : '❌'}`);
  console.log(`   总结: ${podcast.summary ? '✅' : '❌'}`);
  console.log(`   翻译总结: ${podcast.translatedSummary ? '✅' : '❌'}`);
  console.log(`   翻译转写: ${podcast.translatedTranscript ? '✅' : '❌'}`);
  
  // 判断处理流程
  console.log(`\n🔍 处理流程推断:`);
  if (podcast.originalTranscript && podcast.summary) {
    if (!podcast.translatedSummary && !podcast.translatedTranscript) {
      console.log(`   ✅ 中文播客处理流程:`);
      console.log(`      1. ASR转写（生成中文原文）`);
      console.log(`      2. 文本清洗和说话人识别`);
      console.log(`      3. 使用中文提示词生成中文总结`);
      console.log(`      4. 保存到数据库（summary=中文总结，translatedSummary=null）`);
    } else if (podcast.translatedSummary && podcast.translatedTranscript) {
      console.log(`   ✅ 英文播客处理流程:`);
      console.log(`      1. ASR转写（生成英文原文）`);
      console.log(`      2. 文本清洗和说话人识别`);
      console.log(`      3. 使用英文提示词生成英文总结`);
      console.log(`      4. 并行生成中文总结和翻译转写`);
      console.log(`      5. 保存到数据库（summary=英文总结，translatedSummary=中文总结，translatedTranscript=翻译转写）`);
    }
  }
  
  await db.$disconnect();
}

checkPodcastProcessing().catch(console.error);
