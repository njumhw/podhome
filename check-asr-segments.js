const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkASRSegments() {
  try {
    const url = 'https://www.xiaoyuzhoufm.com/episode/690586de48dbe0eb56de79b4';
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 检查ASR Segments传递问题');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 查找播客记录
    const podcast = await prisma.podcast.findFirst({
      where: { sourceUrl: url },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!podcast) {
      console.log('❌ 未找到播客记录');
      return;
    }
    
    // 分析ASR原文结构
    if (podcast.originalTranscript) {
      const asrText = podcast.originalTranscript;
      const paragraphs = asrText.split('\n\n').filter(p => p.trim());
      
      console.log('📊 ASR原文结构分析');
      console.log('───────────────────────────────────────────────────────────');
      console.log('总字符数:', asrText.length);
      console.log('段落数（按\\n\\n分割）:', paragraphs.length);
      console.log('预期片段数（120秒/片段）:', Math.ceil(podcast.duration / 120));
      
      // 模拟segments提取（假设每个段落对应一个segment）
      const simulatedSegments = paragraphs;
      
      console.log('\n🔍 模拟segments提取');
      console.log('───────────────────────────────────────────────────────────');
      console.log('模拟segments数组长度:', simulatedSegments.length);
      console.log('前3个segments长度:', simulatedSegments.slice(0, 3).map((s, i) => `Segment${i+1}: ${s.length}字符`));
      
      // 模拟createABCDEChunksFromSegments的逻辑
      const segmentsPerChunk = 6;
      const expectedChunks = Math.ceil(simulatedSegments.length / segmentsPerChunk);
      console.log('\n📦 模拟分块策略');
      console.log('───────────────────────────────────────────────────────────');
      console.log('segmentsPerChunk:', segmentsPerChunk);
      console.log('预期分块数（每6段一块）:', expectedChunks);
      
      if (simulatedSegments.length <= segmentsPerChunk) {
        console.log('⚠️  段数<=6，会整文清洗（1块）');
        console.log('   这会创建一个巨大的块（144K字符）');
        console.log('   可能导致LLM处理失败或返回原文');
      } else {
        console.log('✅ 段数>6，会分块处理');
        console.log('   预期分块数:', expectedChunks);
        const firstChunkSize = segmentsPerChunk;
        const firstChunk = simulatedSegments.slice(0, firstChunkSize).join('\n\n');
        console.log('   第一块大小:', firstChunk.length, '字符');
        if (firstChunk.length > 50000) {
          console.log('   ⚠️  第一块超过50K字符限制，可能导致问题');
        }
      }
      
      // 检查关键问题：如果segments为空数组
      console.log('\n🚨 关键问题检查');
      console.log('───────────────────────────────────────────────────────────');
      console.log('问题1: 如果segments为空数组会怎样？');
      console.log('  - segmentTexts = []');
      console.log('  - cleanTranscriptWithABCDE会使用createABCDEChunks(transcript)');
      console.log('  - transcript.split("\\n\\n")会产生', paragraphs.length, '个段落');
      console.log('  - 如果段落数<=6，会整文清洗（1块，144K字符）');
      console.log('  - 如果段落数>6，会每6段一块，产生约', Math.ceil(paragraphs.length / 6), '块');
      
      console.log('\n问题2: 为什么清洗稿与ASR原文完全相同？');
      console.log('  可能原因：');
      console.log('  a) LLM处理144K字符的巨大块时，返回了原文（或几乎原文）');
      console.log('  b) cleanTranscriptWithABCDE检测到清洗失败（第111行）');
      console.log('  c) 抛出异常："清洗失败：最终结果与ASR原文完全相同"');
      console.log('  d) audio-processor.ts catch了这个异常');
      console.log('  e) 触发容错机制，使用ASR原文作为清洗稿');
      
      console.log('\n问题3: 为什么任务指标中ASR段落数为0？');
      console.log('  - 如果asrResult.speakers为空数组');
      console.log('  - 则asrData.segments也为空数组');
      console.log('  - asrSegmentsCount会是0');
      console.log('  - 但这不太可能，因为transcript有144K字符');
      
      console.log('\n💡 最可能的问题链：');
      console.log('───────────────────────────────────────────────────────────');
      console.log('1. ASR转写成功，产生73个segments');
      console.log('2. 但由于某种原因，segments没有被正确传递给清洗函数');
      console.log('3. segmentTexts为空数组，清洗函数使用transcript分块');
      console.log('4. 73个段落，每6段一块，产生约13块');
      console.log('5. 每块约11K字符，在LLM处理范围内');
      console.log('6. 但LLM在处理某些块时返回了原文');
      console.log('7. 最终拼接结果与ASR原文完全相同');
      console.log('8. cleanTranscriptWithABCDE检测到语气词数量相同（1375个）');
      console.log('9. 抛出异常，被catch，触发容错机制');
      
      console.log('\n❓ 需要验证的关键点：');
      console.log('───────────────────────────────────────────────────────────');
      console.log('1. 服务器日志中是否有"文本清洗失败"的警告？');
      console.log('2. 服务器日志中是否有"清洗失败：最终结果与ASR原文完全相同"的错误？');
      console.log('3. 服务器日志中是否有"使用ASR原文作为清洗稿（容错机制）"的信息？');
      console.log('4. ASR转写时是否确实返回了73个segments？');
      console.log('5. segments是否正确转换为segmentTexts数组？');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('检查完成');
    console.log('═══════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('检查失败:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkASRSegments();



