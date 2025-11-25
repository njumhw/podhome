import { db } from '../src/server/db';

async function checkSpecificPodcast() {
  try {
    const url = 'https://www.xiaoyuzhoufm.com/episode/64ba0381ead86e7cf1812526';
    
    console.log(`检查播客: ${url}\n`);
    
    // 查找播客
    const podcast = await db.podcast.findFirst({
      where: {
        OR: [
          { sourceUrl: url },
          { audioUrl: { contains: url.split('/').pop() || '' } }
        ]
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        audioUrl: true,
        status: true,
        duration: true,
        summary: true,
        originalTranscript: true,
        reportOutline: true,
        createdAt: true,
        updatedAt: true,
        processingStartedAt: true,
        processingCompletedAt: true,
        createdById: true
      }
    });

    if (!podcast) {
      console.log('❌ 未找到该播客记录');
      return;
    }

    console.log('✅ 找到播客记录:');
    console.log(`  ID: ${podcast.id}`);
    console.log(`  标题: ${podcast.title}`);
    console.log(`  状态: ${podcast.status}`);
    console.log(`  时长: ${podcast.duration} 秒`);
    console.log(`  创建时间: ${podcast.createdAt}`);
    console.log(`  更新时间: ${podcast.updatedAt}`);
    console.log(`  处理开始: ${podcast.processingStartedAt}`);
    console.log(`  处理完成: ${podcast.processingCompletedAt}`);
    console.log(`  创建者ID: ${podcast.createdById || '未设置'}`);
    console.log('');
    
    console.log('内容统计:');
    console.log(`  总结: ${podcast.summary ? `有 (${podcast.summary.length} 字符)` : '无'}`);
    console.log(`  ASR原文: ${podcast.originalTranscript ? `有 (${podcast.originalTranscript.length} 字符)` : '无'}`);
    console.log(`  报告大纲: ${podcast.reportOutline ? `有 (${podcast.reportOutline.length} 字符)` : '无'}`);
    console.log('');
    
    if (podcast.reportOutline) {
      console.log('✅ 报告大纲已生成！');
      console.log(`大纲预览（前500字符）:`);
      console.log(podcast.reportOutline.substring(0, 500));
      console.log('...');
    } else {
      console.log('❌ 报告大纲未生成');
      console.log('可能原因:');
      console.log('  1. 使用了回退方案（单轮生成）');
      console.log('  2. 大纲生成失败');
      console.log('  3. 处理时大纲功能尚未启用');
    }
    
    // 检查任务日志
    const taskLogs = await db.taskLog.findMany({
      where: {
        podcastId: podcast.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    if (taskLogs.length > 0) {
      console.log('\n任务日志:');
      taskLogs.forEach((log, idx) => {
        console.log(`  ${idx + 1}. ${log.step}: ${log.status} (${log.createdAt})`);
      });
    }

  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await db.$disconnect();
  }
}

checkSpecificPodcast();



