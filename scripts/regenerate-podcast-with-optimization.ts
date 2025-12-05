import { PrismaClient } from '@prisma/client';
import { generateReportChunked } from '../src/clients/report-generator';
import { getCachedAudio } from '../src/server/audio-cache';

const prisma = new PrismaClient();

/**
 * 使用新的优化逻辑重新生成播客总结
 * 场景：强制使用分块处理，测试优化策略
 */
async function regeneratePodcastWithOptimization() {
  try {
    const url = 'https://www.xiaoyuzhoufm.com/episode/691c3942b45e5b382f394bd2';
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 使用新优化逻辑重新生成播客总结');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 1. 查找播客记录
    console.log('🔍 查找播客记录...');
    const podcast = await prisma.podcast.findFirst({
      where: { sourceUrl: url },
      select: {
        id: true,
        title: true,
        originalTranscript: true,
        summary: true,
        audioUrl: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!podcast) {
      console.error('❌ 未找到播客记录');
      return;
    }
    
    console.log('✅ 找到播客记录:');
    console.log(`  标题: ${podcast.title}`);
    console.log(`  ASR原文长度: ${podcast.originalTranscript?.length || 0} 字符`);
    console.log(`  当前总结长度: ${podcast.summary?.length || 0} 字符`);
    console.log(`  音频URL: ${podcast.audioUrl || '未设置'}`);
    console.log('');
    
    if (!podcast.originalTranscript || podcast.originalTranscript.length === 0) {
      console.error('❌ ASR原文为空，无法重新生成总结');
      return;
    }
    
    // 2. 获取ASR分段
    console.log('📋 获取ASR分段...');
    let segments: string[] | undefined = undefined;
    
    if (podcast.audioUrl) {
      try {
        const cached = await getCachedAudio(podcast.audioUrl);
        if (cached && cached.segments && Array.isArray(cached.segments)) {
          segments = cached.segments.map((seg: any) => {
            if (typeof seg === 'string') {
              try {
                const parsed = JSON.parse(seg);
                return parsed.text || seg;
              } catch {
                return seg;
              }
            }
            return seg.text || seg;
          }).filter((seg: string) => seg && seg.trim());
          
          console.log(`✅ 从缓存获取到 ${segments.length} 个ASR分段`);
        }
      } catch (error) {
        console.log('⚠️  无法从缓存获取ASR分段:', error);
      }
    }
    
    // 如果没有缓存，按固定长度分割（模拟ASR分段）
    if (!segments || segments.length === 0) {
      console.log('⚠️  未找到ASR分段缓存，按固定长度分割（模拟）...');
      const segmentLength = Math.ceil(podcast.originalTranscript.length / 47); // 假设47段
      segments = [];
      for (let i = 0; i < podcast.originalTranscript.length; i += segmentLength) {
        const segment = podcast.originalTranscript.slice(i, i + segmentLength);
        if (segment.trim()) {
          segments.push(segment.trim());
        }
      }
      console.log(`  模拟ASR分段: ${segments.length} 段`);
    }
    
    console.log(`  平均每段长度: ${Math.ceil(podcast.originalTranscript.length / segments.length)} 字符`);
    console.log('');
    
    // 3. 使用分块处理（会触发优化逻辑）
    console.log('🚀 开始使用分块处理（包含优化逻辑）...');
    console.log('  预期行为：');
    console.log('    1. 先测试每个块');
    console.log('    2. 如果成功率 ≥ 80%，合并成功的ASR片段');
    console.log('    3. 使用整体处理逻辑生成报告');
    console.log('    4. 如果整体处理失败，回退到分块处理+整合逻辑');
    console.log('');
    
    const startTime = Date.now();
    
    try {
      const result = await generateReportChunked({
        transcript: podcast.originalTranscript,
        originalTranscript: podcast.originalTranscript,
        segments: segments, // 传递ASR分段
        title: podcast.title || undefined
      });
      
      const duration = Date.now() - startTime;
      
      console.log('\n✅ 报告生成成功！');
      console.log('  总结长度:', result.summary.length, '字符');
      console.log('  处理时间:', (duration / 1000).toFixed(1), '秒');
      console.log('  估算Token:', result.estimatedTokens.toLocaleString());
      
      if (result.outline) {
        console.log('  报告大纲长度:', result.outline.length, '字符');
      }
      console.log('');
      
      // 分析结果
      const compressionRatio = (result.summary.length / podcast.originalTranscript.length * 100).toFixed(2);
      console.log('📊 结果分析:');
      console.log(`  原始长度: ${podcast.originalTranscript.length.toLocaleString()} 字符`);
      console.log(`  总结长度: ${result.summary.length.toLocaleString()} 字符`);
      console.log(`  压缩比: ${compressionRatio}%`);
      console.log('');
      
      if (parseFloat(compressionRatio) < 5) {
        console.log('⚠️  警告：压缩比过低（<5%），可能存在问题');
      } else if (parseFloat(compressionRatio) > 30) {
        console.log('⚠️  警告：压缩比过高（>30%），可能过度展开');
      } else {
        console.log('✅ 压缩比正常（5%-30%）');
      }
      
      // 4. 更新数据库
      console.log('\n💾 更新数据库...');
      const updateData: any = {
        summary: result.summary,
        updatedAt: new Date()
      };
      
      if (result.outline && result.outline.trim().length > 0) {
        updateData.reportOutline = result.outline;
        console.log('  同时更新报告大纲');
      }
      
      await prisma.podcast.update({
        where: { id: podcast.id },
        data: updateData
      });
      
      console.log('✅ 数据库更新成功！');
      console.log('\n📝 总结预览（前500字符）:');
      console.log(result.summary.substring(0, 500) + '...');
      
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('✅ 重新生成完成！');
      console.log('═══════════════════════════════════════════════════════════\n');
      
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

// 运行脚本
regeneratePodcastWithOptimization();

