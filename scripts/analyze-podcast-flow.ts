import { db } from '../src/server/db';

async function analyzePodcastFlow() {
  const podcastId = process.argv[2] || 'cmk7w0cum000m8onq62fosovq';
  
  console.log(`\n=== 播客处理流程详细分析 ===\n`);
  
  const podcast = await db.podcast.findUnique({
    where: { id: podcastId },
    select: {
      id: true,
      title: true,
      showAuthor: true,
      duration: true,
      originalTranscript: true,
      transcript: true,
      summary: true,
      translatedSummary: true,
      translatedTranscript: true,
      reportOutline: true,
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
  
  console.log(`📋 播客信息:`);
  console.log(`   标题: ${podcast.title}`);
  console.log(`   作者: ${podcast.showAuthor || '未知'}`);
  console.log(`   时长: ${podcast.duration ? `${Math.floor(podcast.duration / 60)}分钟` : '未知'}`);
  
  // 准确的语言检测
  if (podcast.originalTranscript) {
    const transcript = podcast.originalTranscript;
    const chineseCharCount = (transcript.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishCharCount = (transcript.match(/[a-zA-Z]/g) || []).length;
    const totalChars = transcript.length;
    const chineseRatio = (chineseCharCount / totalChars) * 100;
    const englishRatio = (englishCharCount / totalChars) * 100;
    
    console.log(`\n📊 ASR原文分析:`);
    console.log(`   总字符数: ${totalChars.toLocaleString()}`);
    console.log(`   中文字符: ${chineseCharCount.toLocaleString()} (${chineseRatio.toFixed(1)}%)`);
    console.log(`   英文字符: ${englishCharCount.toLocaleString()} (${englishRatio.toFixed(1)}%)`);
    
    const isEnglish = englishRatio > 50;
    const isChinese = chineseRatio > 50;
    
    if (isEnglish) {
      console.log(`   ✅ 检测为英文播客`);
    } else if (isChinese) {
      console.log(`   ✅ 检测为中文播客`);
    } else {
      console.log(`   ⚠️ 混合语言`);
    }
    
    console.log(`\n   前200字符预览:`);
    console.log(`   ${transcript.substring(0, 200)}...`);
  }
  
  // 处理时间
  if (podcast.processingStartedAt && podcast.processingCompletedAt) {
    const duration = podcast.processingCompletedAt.getTime() - podcast.processingStartedAt.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    console.log(`\n⏱️ 处理时间:`);
    console.log(`   开始: ${podcast.processingStartedAt.toLocaleString('zh-CN')}`);
    console.log(`   完成: ${podcast.processingCompletedAt.toLocaleString('zh-CN')}`);
    console.log(`   总耗时: ${minutes}分${seconds}秒 (${(duration / 1000).toFixed(0)}秒)`);
  }
  
  // 内容字段分析
  console.log(`\n📝 生成内容分析:`);
  
  console.log(`\n   1. ASR原文 (originalTranscript):`);
  console.log(`      ${podcast.originalTranscript ? `✅ ${podcast.originalTranscript.length.toLocaleString()} 字符` : '❌ 未生成'}`);
  
  console.log(`\n   2. 清洗稿 (transcript):`);
  console.log(`      ${podcast.transcript ? `✅ ${podcast.transcript.length.toLocaleString()} 字符` : '❌ 未生成'}`);
  if (podcast.originalTranscript && podcast.transcript) {
    const diff = Math.abs(podcast.originalTranscript.length - podcast.transcript.length);
    const diffPercent = (diff / podcast.originalTranscript.length) * 100;
    if (diffPercent < 1) {
      console.log(`      (与ASR原文长度几乎相同，清洗未大幅改变内容)`);
    } else {
      console.log(`      (与ASR原文长度差异: ${diffPercent.toFixed(1)}%)`);
    }
  }
  
  console.log(`\n   3. 总结 (summary):`);
  if (podcast.summary) {
    console.log(`      ✅ ${podcast.summary.length.toLocaleString()} 字符`);
    const summaryChinese = (podcast.summary.match(/[\u4e00-\u9fa5]/g) || []).length;
    const summaryEnglish = (podcast.summary.match(/[a-zA-Z]/g) || []).length;
    const summaryTotal = podcast.summary.length;
    const summaryChineseRatio = (summaryChinese / summaryTotal) * 100;
    const summaryEnglishRatio = (summaryEnglish / summaryTotal) * 100;
    
    if (summaryEnglishRatio > 50) {
      console.log(`      语言: 英文 (${summaryEnglishRatio.toFixed(1)}% 英文)`);
    } else if (summaryChineseRatio > 50) {
      console.log(`      语言: 中文 (${summaryChineseRatio.toFixed(1)}% 中文)`);
    } else {
      console.log(`      语言: 混合`);
    }
    
    console.log(`      前200字符: ${podcast.summary.substring(0, 200)}...`);
    
    // 检查是否包含报告概述
    if (podcast.summary.includes('报告概述') || podcast.summary.includes('Executive Summary') || podcast.summary.includes('Introduction')) {
      console.log(`      ✅ 包含报告概述/引言部分`);
    }
  } else {
    console.log(`      ❌ 未生成`);
  }
  
  console.log(`\n   4. 翻译总结 (translatedSummary):`);
  if (podcast.translatedSummary) {
    console.log(`      ✅ ${podcast.translatedSummary.length.toLocaleString()} 字符`);
    console.log(`      前200字符: ${podcast.translatedSummary.substring(0, 200)}...`);
  } else {
    console.log(`      ❌ 未生成`);
  }
  
  console.log(`\n   5. 翻译转写 (translatedTranscript):`);
  if (podcast.translatedTranscript) {
    console.log(`      ✅ ${podcast.translatedTranscript.length.toLocaleString()} 字符`);
    console.log(`      前200字符: ${podcast.translatedTranscript.substring(0, 200)}...`);
  } else {
    console.log(`      ❌ 未生成`);
  }
  
  console.log(`\n   6. 报告大纲 (reportOutline):`);
  if (podcast.reportOutline) {
    console.log(`      ✅ ${podcast.reportOutline.length.toLocaleString()} 字符`);
    console.log(`      前200字符: ${podcast.reportOutline.substring(0, 200)}...`);
  } else {
    console.log(`      ❌ 未生成 (单轮生成模式)`);
  }
  
  // 处理流程推断
  console.log(`\n🔍 处理流程推断:`);
  
  const hasEnglishSummary = podcast.summary && (podcast.summary.match(/[a-zA-Z]/g) || []).length > (podcast.summary.match(/[\u4e00-\u9fa5]/g) || []).length;
  const hasChineseSummary = podcast.translatedSummary !== null;
  const hasTranslatedTranscript = podcast.translatedTranscript !== null;
  
  if (hasEnglishSummary && hasChineseSummary && hasTranslatedTranscript) {
    console.log(`   ✅ 英文播客处理流程:`);
    console.log(`      1. ASR转写 → 生成英文原文 (${podcast.originalTranscript?.length.toLocaleString()} 字符)`);
    console.log(`      2. 文本清洗和说话人识别`);
    console.log(`      3. 使用英文提示词生成英文总结 (${podcast.summary?.length.toLocaleString()} 字符)`);
    console.log(`      4. 并行生成:`);
    console.log(`         - 使用中文提示词生成中文总结 (${podcast.translatedSummary?.length.toLocaleString()} 字符)`);
    console.log(`         - 翻译整个ASR原文为中文 (${podcast.translatedTranscript?.length.toLocaleString()} 字符)`);
    console.log(`      5. 保存到数据库:`);
    console.log(`         - summary = 英文总结`);
    console.log(`         - translatedSummary = 中文总结`);
    console.log(`         - translatedTranscript = 翻译转写`);
  } else if (!hasChineseSummary && !hasTranslatedTranscript) {
    console.log(`   ✅ 中文播客处理流程:`);
    console.log(`      1. ASR转写 → 生成中文原文 (${podcast.originalTranscript?.length.toLocaleString()} 字符)`);
    console.log(`      2. 文本清洗和说话人识别`);
    console.log(`      3. 使用中文提示词生成中文总结 (${podcast.summary?.length.toLocaleString()} 字符)`);
    console.log(`      4. 保存到数据库:`);
    console.log(`         - summary = 中文总结`);
    console.log(`         - translatedSummary = null`);
    console.log(`         - translatedTranscript = null`);
  }
  
  // 压缩比分析
  if (podcast.originalTranscript && podcast.summary) {
    const compressionRatio = (podcast.summary.length / podcast.originalTranscript.length) * 100;
    console.log(`\n📊 压缩比分析:`);
    console.log(`   ASR原文: ${podcast.originalTranscript.length.toLocaleString()} 字符`);
    console.log(`   总结: ${podcast.summary.length.toLocaleString()} 字符`);
    console.log(`   压缩比: ${compressionRatio.toFixed(1)}%`);
    
    if (podcast.translatedSummary) {
      const chineseCompressionRatio = (podcast.translatedSummary.length / podcast.originalTranscript.length) * 100;
      console.log(`   中文总结: ${podcast.translatedSummary.length.toLocaleString()} 字符`);
      console.log(`   中文压缩比: ${chineseCompressionRatio.toFixed(1)}%`);
    }
  }
  
  await db.$disconnect();
}

analyzePodcastFlow().catch(console.error);

