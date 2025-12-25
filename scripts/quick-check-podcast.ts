import { db } from '../src/server/db';

async function check() {
  const podcast = await db.podcast.findUnique({
    where: { id: 'cmjkakohk0004lyzsk2ro6mx1' },
  });
  
  if (!podcast) {
    console.log('未找到播客');
    process.exit(1);
  }
  
  console.log('播客信息:');
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
    const englishWords = (sample.match(/\b(the|and|is|are|was|were|this|that|with|from|have|has|been|will|would|could|should|may|might|can|must|do|does|did|not|no|yes|you|we|they|he|she|it|I|me|my|your|our|their|his|her|its)\b/gi) || []).length;
    const chineseChars = (sample.match(/[\u4e00-\u9fa5]/g) || []).length;
    console.log('');
    console.log('总结语言分析:');
    console.log('  英文单词数:', englishWords);
    console.log('  中文字符数:', chineseChars);
    console.log('  判断:', englishWords > 10 && chineseChars < 5 ? '✅ 英文' : chineseChars > 10 ? '❌ 中文' : '⚠️ 未知');
    console.log('');
    console.log('总结预览（前500字符）:');
    console.log(podcast.summary.substring(0, 500));
  }
  
  // 检查原始转写语言
  if (podcast.originalTranscript) {
    const sample = podcast.originalTranscript.substring(0, 500);
    const englishWords = (sample.match(/\b(the|and|is|are|was|were|this|that|with|from|have|has|been|will|would|could|should|may|might|can|must|do|does|did|not|no|yes|you|we|they|he|she|it|I|me|my|your|our|their|his|her|its)\b/gi) || []).length;
    const chineseChars = (sample.match(/[\u4e00-\u9fa5]/g) || []).length;
    console.log('');
    console.log('原始转写语言分析:');
    console.log('  英文单词数:', englishWords);
    console.log('  中文字符数:', chineseChars);
    console.log('  判断:', englishWords > 10 && chineseChars < 5 ? '✅ 英文' : chineseChars > 10 ? '❌ 中文' : '⚠️ 未知');
  }
  
  process.exit(0);
}

check().catch(console.error);

