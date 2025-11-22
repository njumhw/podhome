const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeParallelCleaning() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 并行清洗问题分析：为什么长时长失败，短时长成功？');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const shortUrl = 'https://www.xiaoyuzhoufm.com/episode/69044c189755cb9a6812a415'; // 52分钟
    const longUrl = 'https://www.xiaoyuzhoufm.com/episode/690586de48dbe0eb56de79b4'; // 146分钟
    
    const shortPodcast = await prisma.podcast.findFirst({
      where: { sourceUrl: shortUrl },
      orderBy: { createdAt: 'desc' }
    });
    
    const longPodcast = await prisma.podcast.findFirst({
      where: { sourceUrl: longUrl },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!shortPodcast || !longPodcast) {
      console.log('❌ 未找到播客记录');
      return;
    }
    
    console.log('📊 关键差异');
    console.log('───────────────────────────────────────────────────────────');
    
    // ASR段落数
    const shortParagraphs = shortPodcast.originalTranscript.split('\n\n').filter(p => p.trim());
    const longParagraphs = longPodcast.originalTranscript.split('\n\n').filter(p => p.trim());
    
    console.log('ASR段落数:');
    console.log('  短时长:', shortParagraphs.length, '个');
    console.log('  长时长:', longParagraphs.length, '个');
    
    // 分块数
    const segmentsPerChunk = 6;
    const shortChunks = Math.ceil(shortParagraphs.length / segmentsPerChunk);
    const longChunks = Math.ceil(longParagraphs.length / segmentsPerChunk);
    
    console.log('\\n预期清洗分块数（每6段一块）:');
    console.log('  短时长:', shortChunks, '块（A块 +', shortChunks - 1, '个后续块）');
    console.log('  长时长:', longChunks, '块（A块 +', longChunks - 1, '个后续块）');
    
    // 分析Promise.all的问题
    console.log('\\n🔍 Promise.all并行处理分析');
    console.log('───────────────────────────────────────────────────────────');
    console.log('短时长播客：');
    console.log('  - A块（首块）：单独处理，生成角色库');
    console.log('  - 后续块：', shortChunks - 1, '个块，使用Promise.all并行处理');
    console.log('  - 如果所有块成功：清洗正常完成 ✅');
    console.log('  - 如果某个块失败：Promise.all立即失败，抛出异常 ❌');
    
    console.log('\\n长时长播客：');
    console.log('  - A块（首块）：单独处理，生成角色库');
    console.log('  - 后续块：', longChunks - 1, '个块（12个块），使用Promise.all并行处理');
    console.log('  - 问题：12个块并行处理，成功率降低');
    console.log('  - 如果某个块失败：Promise.all立即失败，整个清洗失败');
    
    console.log('\\n🚨 关键发现：Promise.all的失败机制');
    console.log('───────────────────────────────────────────────────────────');
    console.log('1. Promise.all的特性：');
    console.log('   - 如果任何一个Promise失败，Promise.all立即失败');
    console.log('   - 其他正在执行的Promise会被取消或忽略');
    console.log('   - 抛出第一个失败Promise的错误');
    
    console.log('\\n2. 对于长时长播客（12个后续块）：');
    console.log('   - 12个块并行处理，任何一个失败都会导致整体失败');
    console.log('   - 如果第3个块失败，第4-12个块可能还在处理，但结果会被丢弃');
    console.log('   - 失败率 = 1 - (单个块成功率)^12');
    console.log('   - 假设单个块成功率90%，整体成功率 = 0.9^12 ≈ 28%');
    
    console.log('\\n3. 对于短时长播客（4个后续块）：');
    console.log('   - 4个块并行处理，成功率相对较高');
    console.log('   - 假设单个块成功率90%，整体成功率 = 0.9^4 ≈ 66%');
    
    console.log('\\n💡 可能的问题场景（长时长播客）');
    console.log('───────────────────────────────────────────────────────────');
    console.log('场景A：某个块返回原文，触发验证异常');
    console.log('  1. 第5个块（F块）处理时，LLM返回了原文');
    console.log('  2. processOtherBlock检测到语气词数量相同');
    console.log('  3. 抛出异常："F块清洗失败：语气词未删除"');
    console.log('  4. Promise.all立即失败，整个清洗过程失败');
    console.log('  5. 异常被audio-processor.ts catch');
    console.log('  6. 触发容错机制，使用ASR原文');
    
    console.log('\\n场景B：某个块超时或网络错误');
    console.log('  1. 第8个块（I块）处理时，LLM调用超时');
    console.log('  2. qwenChat抛出超时异常');
    console.log('  3. Promise.all立即失败');
    console.log('  4. 异常被catch，触发容错机制');
    
    console.log('\\n场景C：块太大，LLM处理失败');
    console.log('  1. 某个块超过LLM处理能力（虽然每块约11K字符）');
    console.log('  2. LLM返回错误或空结果');
    console.log('  3. 触发验证失败，抛出异常');
    console.log('  4. Promise.all失败');
    
    console.log('\\n💡 为什么短时长成功？');
    console.log('───────────────────────────────────────────────────────────');
    console.log('1. 只有4个后续块，并行处理的块数较少');
    console.log('   - 整体成功率更高（0.9^4 ≈ 66%）');
    console.log('   - 即使某个块有问题，其他块成功的概率较高');
    
    console.log('\\n2. 处理时间更短');
    console.log('   - 短时长播客处理更快，超时概率更低');
    console.log('   - LLM调用更稳定');
    
    console.log('\\n3. 资源压力更小');
    console.log('   - 12个块并行可能超过LLM API的并发限制');
    console.log('   - 4个块并行压力更小，成功率更高');
    
    console.log('\\n🔧 解决方案建议');
    console.log('───────────────────────────────────────────────────────────');
    console.log('1. 改进Promise.all的错误处理：');
    console.log('   - 使用Promise.allSettled替代Promise.all');
    console.log('   - 即使某些块失败，也继续处理其他块');
    console.log('   - 最后汇总成功和失败的块');
    
    console.log('\\n2. 添加重试机制：');
    console.log('   - 对于失败的块，自动重试（最多3次）');
    console.log('   - 只有重试都失败时，才标记为失败');
    
    console.log('\\n3. 限制并发数：');
    console.log('   - 不要同时处理太多块（如限制为5个并发）');
    console.log('   - 分批处理：先处理5个块，再处理下一批');
    
    console.log('\\n4. 改进错误处理策略：');
    console.log('   - 如果只有少数块失败（如<20%），继续使用成功块的清洗结果');
    console.log('   - 如果大部分块失败，才真正失败');
    
    console.log('\\n═══════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('分析失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeParallelCleaning();



