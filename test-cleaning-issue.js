/**
 * 诊断清洗问题的测试脚本
 * 检查为什么清洗结果与ASR原文完全相同
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseCleaningIssue() {
  try {
    console.log('=== 诊断清洗问题 ===\n');
    
    // 查找清洗稿和ASR原文完全相同的播客
    const podcasts = await prisma.podcast.findMany({
      where: {
        status: 'READY',
        originalTranscript: { not: null },
        transcript: { not: null }
      },
      select: {
        id: true,
        title: true,
        originalTranscript: true,
        transcript: true,
        sourceUrl: true
      },
      take: 5
    });
    
    console.log(`找到 ${podcasts.length} 个播客记录\n`);
    
    for (const podcast of podcasts) {
      const isIdentical = podcast.originalTranscript === podcast.transcript;
      const lengthMatch = podcast.originalTranscript?.length === podcast.transcript?.length;
      
      console.log(`播客: ${podcast.title}`);
      console.log(`ID: ${podcast.id}`);
      console.log(`ASR原文长度: ${podcast.originalTranscript?.length || 0}`);
      console.log(`清洗稿长度: ${podcast.transcript?.length || 0}`);
      console.log(`完全相等: ${isIdentical}`);
      console.log(`长度相等: ${lengthMatch}`);
      
      if (isIdentical || lengthMatch) {
        console.log('⚠️ 发现问题：清洗稿与ASR原文相同或长度相同！');
        
        // 检查前1000字符是否完全相同
        const asrSample = podcast.originalTranscript?.substring(0, 1000) || '';
        const cleanedSample = podcast.transcript?.substring(0, 1000) || '';
        const sampleIdentical = asrSample === cleanedSample;
        console.log(`样本（前1000字符）相同: ${sampleIdentical}`);
        
        if (sampleIdentical) {
          console.log('\n可能的原因：');
          console.log('1. LLM返回了原文（提示词过于保守）');
          console.log('2. 清洗函数有bug，直接返回了原文');
          console.log('3. 缓存逻辑错误，跳过了清洗');
          console.log('4. 错误处理导致使用ASR原文作为备选');
        }
      }
      
      console.log('\n---\n');
    }
    
    // 检查最近的失败任务
    console.log('=== 检查最近的失败任务 ===\n');
    const failedTasks = await prisma.taskQueue.findMany({
      where: {
        status: 'FAILED',
        error: { contains: '清洗' }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });
    
    console.log(`找到 ${failedTasks.length} 个清洗相关的失败任务\n`);
    for (const task of failedTasks) {
      console.log(`任务ID: ${task.id}`);
      console.log(`错误: ${task.error}`);
      console.log(`创建时间: ${task.createdAt}`);
      console.log('---\n');
    }
    
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseCleaningIssue();




