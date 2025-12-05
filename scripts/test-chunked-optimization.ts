import { PrismaClient } from '@prisma/client';
import { getCachedAudio } from '../src/server/audio-cache';

const prisma = new PrismaClient();

/**
 * 测试分块处理的优化逻辑
 * 场景：检查播客的ASR分段数据，验证优化策略的触发条件
 */
async function testChunkedOptimization() {
  try {
    const url = 'https://www.xiaoyuzhoufm.com/episode/691c3942b45e5b382f394bd2';
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 测试分块处理优化逻辑');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 1. 查找播客记录
    console.log('🔍 查找播客记录...');
    const podcast = await prisma.podcast.findFirst({
      where: { sourceUrl: url },
      select: {
        id: true,
        title: true,
        originalTranscript: true,
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
    console.log(`  音频URL: ${podcast.audioUrl || '未设置'}`);
    console.log('');
    
    if (!podcast.originalTranscript || podcast.originalTranscript.length === 0) {
      console.error('❌ ASR原文为空，无法测试');
      return;
    }
    
    // 2. 尝试从缓存获取ASR分段
    console.log('📋 尝试从缓存获取ASR分段...');
    let segments: string[] | undefined = undefined;
    
    if (podcast.audioUrl) {
      try {
        const cached = await getCachedAudio(podcast.audioUrl);
        if (cached && cached.segments && Array.isArray(cached.segments)) {
          // segments 可能是字符串数组或JSON字符串数组
          segments = cached.segments.map((seg: any) => {
            if (typeof seg === 'string') {
              try {
                // 尝试解析JSON字符串
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
    
    // 3. 如果没有缓存，模拟ASR分段
    if (!segments || segments.length === 0) {
      console.log('📋 模拟ASR分段（用于测试）...');
      // 模拟73个ASR分段（每段约120秒）
      const segmentLength = Math.ceil(podcast.originalTranscript.length / 73);
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
    
    // 4. 验证优化策略的触发条件
    console.log('🔍 验证优化策略的触发条件...');
    console.log('');
    
    const MIN_SUCCESS_RATE = 0.8; // 最低成功率阈值
    const maxInputTokens = 900000; // 安全边界
    
    // 模拟不同的成功率场景
    const testScenarios = [
      { name: '高成功率场景', successCount: 27, totalCount: 28 }, // 96.4%
      { name: '中等成功率场景', successCount: 20, totalCount: 28 }, // 71.4%
      { name: '低成功率场景', successCount: 15, totalCount: 28 }, // 53.6%
      { name: '刚好阈值场景', successCount: 23, totalCount: 28 }, // 82.1%
    ];
    
    for (const scenario of testScenarios) {
      const successRate = scenario.successCount / scenario.totalCount;
      const successfulSegments = segments.slice(0, scenario.successCount);
      const mergedTranscript = successfulSegments.join('\n\n');
      const mergedLength = mergedTranscript.length;
      const estimatedTokens = mergedLength;
      const promptTokens = 10000;
      const totalInputTokens = estimatedTokens + promptTokens;
      
      console.log(`📊 ${scenario.name}:`);
      console.log(`  成功率: ${(successRate * 100).toFixed(1)}% (${scenario.successCount}/${scenario.totalCount})`);
      console.log(`  合并后长度: ${mergedLength.toLocaleString()} 字符`);
      console.log(`  估算Token: ${totalInputTokens.toLocaleString()}`);
      
      const canUseOptimization = 
        successRate >= MIN_SUCCESS_RATE &&
        segments.length > 0 &&
        totalInputTokens <= maxInputTokens;
      
      if (canUseOptimization) {
        console.log(`  ✅ 满足优化条件，会使用整体处理逻辑`);
      } else {
        const reasons: string[] = [];
        if (successRate < MIN_SUCCESS_RATE) {
          reasons.push(`成功率 ${(successRate * 100).toFixed(1)}% < ${(MIN_SUCCESS_RATE * 100)}%`);
        }
        if (segments.length === 0) {
          reasons.push('无ASR分段');
        }
        if (totalInputTokens > maxInputTokens) {
          reasons.push(`Token数 ${totalInputTokens.toLocaleString()} > ${maxInputTokens.toLocaleString()}`);
        }
        console.log(`  ❌ 不满足优化条件: ${reasons.join(', ')}`);
        console.log(`  → 会回退到分块处理+整合逻辑`);
      }
      console.log('');
    }
    
    // 5. 实际场景分析
    console.log('📊 实际场景分析（基于当前播客数据）:');
    console.log(`  ASR原文长度: ${podcast.originalTranscript.length.toLocaleString()} 字符`);
    console.log(`  ASR分段数量: ${segments.length} 段`);
    console.log(`  平均每段长度: ${Math.ceil(podcast.originalTranscript.length / segments.length)} 字符`);
    console.log('');
    
    // 计算不同成功率场景（基于实际分段数量）
    const testCases = [
      { name: '高成功率（约80%）', ratio: 0.8 },
      { name: '很高成功率（约90%）', ratio: 0.9 },
      { name: '极高成功率（约95%）', ratio: 0.95 },
    ];
    
    console.log(`\n基于实际分段数量（${segments.length}段）的不同场景:`);
    console.log('');
    
    for (const testCase of testCases) {
      const simulatedSuccessCount = Math.floor(segments.length * testCase.ratio);
      const simulatedSuccessRate = simulatedSuccessCount / segments.length;
      const simulatedSuccessfulSegments = segments.slice(0, simulatedSuccessCount);
      const simulatedMergedTranscript = simulatedSuccessfulSegments.join('\n\n');
      const simulatedMergedLength = simulatedMergedTranscript.length;
      const simulatedEstimatedTokens = simulatedMergedLength;
      const simulatedPromptTokens = 10000;
      const simulatedTotalInputTokens = simulatedEstimatedTokens + simulatedPromptTokens;
      
      console.log(`📊 ${testCase.name}:`);
      console.log(`  成功块数: ${simulatedSuccessCount}/${segments.length}`);
      console.log(`  成功率: ${(simulatedSuccessRate * 100).toFixed(1)}%`);
      console.log(`  合并后长度: ${simulatedMergedLength.toLocaleString()} 字符`);
      console.log(`  估算Token: ${simulatedTotalInputTokens.toLocaleString()}`);
      console.log(`  是否在限制内: ${simulatedTotalInputTokens <= maxInputTokens ? '✅ 是' : '❌ 否'}`);
      
      const wouldUseOptimization = 
        simulatedSuccessRate >= MIN_SUCCESS_RATE &&
        segments.length > 0 &&
        simulatedTotalInputTokens <= maxInputTokens;
      
      if (wouldUseOptimization) {
        console.log(`  ✅ 会触发优化策略！`);
        console.log(`    → 会合并成功的ASR片段，使用整体处理逻辑生成报告`);
      } else {
        const reasons: string[] = [];
        if (simulatedSuccessRate < MIN_SUCCESS_RATE) {
          reasons.push(`成功率 ${(simulatedSuccessRate * 100).toFixed(1)}% < ${(MIN_SUCCESS_RATE * 100)}%`);
        }
        if (simulatedTotalInputTokens > maxInputTokens) {
          reasons.push(`Token数超限`);
        }
        console.log(`  ❌ 不会触发优化策略: ${reasons.join(', ')}`);
        console.log(`    → 会使用分块处理+整合逻辑`);
      }
      console.log('');
    }
    
    // 计算刚好达到80%阈值的情况
    const thresholdSuccessCount = Math.ceil(segments.length * MIN_SUCCESS_RATE);
    const thresholdSuccessRate = thresholdSuccessCount / segments.length;
    const thresholdSuccessfulSegments = segments.slice(0, thresholdSuccessCount);
    const thresholdMergedTranscript = thresholdSuccessfulSegments.join('\n\n');
    const thresholdMergedLength = thresholdMergedTranscript.length;
    const thresholdEstimatedTokens = thresholdMergedLength;
    const thresholdPromptTokens = 10000;
    const thresholdTotalInputTokens = thresholdEstimatedTokens + thresholdPromptTokens;
    
    console.log(`\n🎯 刚好达到80%阈值的情况:`);
    console.log(`  成功块数: ${thresholdSuccessCount}/${segments.length}`);
    console.log(`  成功率: ${(thresholdSuccessRate * 100).toFixed(1)}%`);
    console.log(`  合并后长度: ${thresholdMergedLength.toLocaleString()} 字符`);
    console.log(`  估算Token: ${thresholdTotalInputTokens.toLocaleString()}`);
    console.log(`  是否在限制内: ${thresholdTotalInputTokens <= maxInputTokens ? '✅ 是' : '❌ 否'}`);
    
    const wouldUseOptimizationAtThreshold = 
      thresholdSuccessRate >= MIN_SUCCESS_RATE &&
      segments.length > 0 &&
      thresholdTotalInputTokens <= maxInputTokens;
    
    if (wouldUseOptimizationAtThreshold) {
      console.log(`\n✅ 结论：会触发优化策略！`);
      console.log(`  1. 成功率 ${(thresholdSuccessRate * 100).toFixed(1)}% ≥ ${(MIN_SUCCESS_RATE * 100)}% ✅`);
      console.log(`  2. 有ASR分段（${segments.length}段）✅`);
      console.log(`  3. 合并后Token数 ${thresholdTotalInputTokens.toLocaleString()} ≤ ${maxInputTokens.toLocaleString()} ✅`);
      console.log(`  → 会合并成功的ASR片段，使用整体处理逻辑生成报告`);
    } else {
      console.log(`\n❌ 结论：不会触发优化策略`);
      console.log(`  → 会使用分块处理+整合逻辑`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ 测试完成！');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testChunkedOptimization();

