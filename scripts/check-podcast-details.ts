import { db } from '../src/server/db';

async function checkPodcastDetails() {
  const podcastId = process.argv[2] || 'cmk7saf8n0004lyj4f58ne5sk';
  
  console.log(`\n=== 检查播客 ${podcastId} 的详细信息 ===\n`);
  
  // 查询播客信息
  const podcast = await db.podcast.findUnique({
    where: { id: podcastId },
    select: {
      id: true,
      title: true,
      showAuthor: true,
      publishedAt: true,
      status: true,
      processingStartedAt: true,
      processingCompletedAt: true,
      duration: true,
      // 检查各个字段的长度
      originalTranscript: true,
      transcript: true,
      translatedTranscript: true,
      summary: true,
      translatedSummary: true,
      reportOutline: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  
  if (!podcast) {
    console.log('❌ 播客不存在');
    await db.$disconnect();
    return;
  }
  
  console.log('📋 基本信息:');
  console.log(`   标题: ${podcast.title}`);
  console.log(`   作者: ${podcast.showAuthor || '未知'}`);
  console.log(`   状态: ${podcast.status}`);
  console.log(`   时长: ${podcast.duration ? `${Math.floor(podcast.duration / 60)}分钟` : '未知'}`);
  console.log(`   发布时间: ${podcast.publishedAt || '未知'}`);
  console.log(`   创建时间: ${podcast.createdAt}`);
  console.log(`   更新时间: ${podcast.updatedAt}`);
  console.log(`   处理开始: ${podcast.processingStartedAt || '未知'}`);
  console.log(`   处理完成: ${podcast.processingCompletedAt || '未知'}`);
  
  if (podcast.processingStartedAt && podcast.processingCompletedAt) {
    const duration = podcast.processingCompletedAt.getTime() - podcast.processingStartedAt.getTime();
    console.log(`   处理耗时: ${(duration / 1000 / 60).toFixed(1)} 分钟`);
  }
  
  console.log('\n📝 内容字段:');
  console.log(`   originalTranscript (ASR原文): ${podcast.originalTranscript ? `${podcast.originalTranscript.length} 字符` : 'null'}`);
  if (podcast.originalTranscript) {
    console.log(`   前100字符: ${podcast.originalTranscript.substring(0, 100)}...`);
  }
  
  console.log(`   transcript (清洗稿): ${podcast.transcript ? `${podcast.transcript.length} 字符` : 'null'}`);
  if (podcast.transcript) {
    console.log(`   前100字符: ${podcast.transcript.substring(0, 100)}...`);
  }
  
  console.log(`   translatedTranscript (翻译转写): ${podcast.translatedTranscript ? `${podcast.translatedTranscript.length} 字符` : 'null'}`);
  if (podcast.translatedTranscript) {
    console.log(`   前100字符: ${podcast.translatedTranscript.substring(0, 100)}...`);
  }
  
  console.log(`   summary (总结): ${podcast.summary ? `${podcast.summary.length} 字符` : 'null'}`);
  if (podcast.summary) {
    console.log(`   前200字符: ${podcast.summary.substring(0, 200)}...`);
    // 检查语言
    const hasChinese = /[\u4e00-\u9fa5]/.test(podcast.summary);
    const hasEnglish = /[a-zA-Z]/.test(podcast.summary);
    console.log(`   语言检测: ${hasChinese ? '包含中文' : ''} ${hasEnglish ? '包含英文' : ''}`);
  }
  
  console.log(`   translatedSummary (翻译总结): ${podcast.translatedSummary ? `${podcast.translatedSummary.length} 字符` : 'null'}`);
  if (podcast.translatedSummary) {
    console.log(`   前200字符: ${podcast.translatedSummary.substring(0, 200)}...`);
  }
  
  console.log(`   reportOutline (报告大纲): ${podcast.reportOutline ? `${podcast.reportOutline.length} 字符` : 'null'}`);
  if (podcast.reportOutline) {
    console.log(`   前200字符: ${podcast.reportOutline.substring(0, 200)}...`);
  }
  
  // 分析处理结果
  console.log('\n🔍 处理结果分析:');
  
  if (podcast.originalTranscript) {
    const transcriptLanguage = /[\u4e00-\u9fa5]/.test(podcast.originalTranscript) ? '中文' : '英文';
    console.log(`   ASR语言: ${transcriptLanguage}`);
    
    if (transcriptLanguage === '英文') {
      console.log(`   ✅ 英文播客处理逻辑:`);
      console.log(`      - 应该有英文总结 (summary): ${podcast.summary ? '✅' : '❌'}`);
      console.log(`      - 应该有中文总结 (translatedSummary): ${podcast.translatedSummary ? '✅' : '❌'}`);
      console.log(`      - 应该有翻译转写 (translatedTranscript): ${podcast.translatedTranscript ? '✅' : '❌'}`);
    } else {
      console.log(`   ✅ 中文播客处理逻辑:`);
      console.log(`      - 应该有中文总结 (summary): ${podcast.summary ? '✅' : '❌'}`);
      console.log(`      - 不应该有翻译总结 (translatedSummary): ${!podcast.translatedSummary ? '✅' : '❌'}`);
    }
  } else {
    console.log('   ⚠️ 没有 ASR 原文');
  }
  
  await db.$disconnect();
}

checkPodcastDetails().catch(console.error);
