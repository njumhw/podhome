import { PrismaClient } from '@prisma/client';
import { generateReportWhole } from '../src/clients/report-generator';

const prisma = new PrismaClient();

async function regenerateSummary() {
  try {
    const podcastId = 'cmirl814e000w5ylpjpfuw0oy';
    const url = 'https://www.xiaoyuzhoufm.com/episode/691c3942b45e5b382f394bd2';
    
    console.log('🔍 查找播客记录...');
    const podcast = await prisma.podcast.findUnique({
      where: { id: podcastId },
      select: {
        id: true,
        title: true,
        originalTranscript: true,
        summary: true,
        reportOutline: true,
        audioUrl: true
      }
    });
    
    if (!podcast) {
      console.error('❌ 未找到播客记录');
      return;
    }
    
    console.log('📊 播客信息:');
    console.log('  标题:', podcast.title);
    console.log('  ASR原文长度:', podcast.originalTranscript?.length || 0, '字符');
    console.log('  当前总结长度:', podcast.summary?.length || 0, '字符');
    console.log('  报告大纲长度:', podcast.reportOutline?.length || 0, '字符');
    
    if (!podcast.originalTranscript || podcast.originalTranscript.length === 0) {
      console.error('❌ ASR原文为空，无法重新生成总结');
      return;
    }
    
    console.log('\n🔄 开始重新生成播客总结...');
    console.log('  使用单轮生成模式（直接基于ASR原文生成）');
    
    const startTime = Date.now();
    
    try {
      // 使用单轮生成模式，直接基于ASR原文生成报告
      const result = await generateReportWhole({
        transcript: podcast.originalTranscript,
        title: podcast.title || undefined,
        segments: undefined // 不使用分段，直接整体生成
      });
      
      const duration = Date.now() - startTime;
      
      console.log('\n✅ 报告生成成功！');
      console.log('  总结长度:', result.summary.length, '字符');
      console.log('  处理时间:', (duration / 1000).toFixed(1), '秒');
      console.log('  估算Token:', result.estimatedTokens.toLocaleString());
      
      if (result.outline) {
        console.log('  报告大纲长度:', result.outline.length, '字符');
      }
      
      // 更新数据库
      console.log('\n💾 更新数据库...');
      const updateData: any = {
        summary: result.summary,
        updatedAt: new Date()
      };
      
      // 如果有大纲，也更新大纲
      if (result.outline && result.outline.trim().length > 0) {
        updateData.reportOutline = result.outline;
        console.log('  同时更新报告大纲');
      }
      
      await prisma.podcast.update({
        where: { id: podcastId },
        data: updateData
      });
      
      console.log('✅ 数据库更新成功！');
      console.log('\n📝 总结预览（前500字符）:');
      console.log(result.summary.substring(0, 500) + '...');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('\n❌ 报告生成失败:', errorMessage);
      console.error('错误详情:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

regenerateSummary();

