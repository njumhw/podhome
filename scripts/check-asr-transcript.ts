import { db } from '../src/server/db';

async function checkAsrTranscript(podcastId: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 检查ASR转录完整性');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. 查找播客记录
  const podcast = await db.podcast.findUnique({
    where: { id: podcastId }
  });

  if (!podcast) {
    console.log('❌ 未找到播客记录');
    process.exit(1);
  }

  console.log('=== 播客基本信息 ===');
  console.log(`标题: ${podcast.title}`);
  console.log(`音频URL: ${podcast.audioUrl}`);
  if (podcast.duration) {
    const minutes = Math.round(podcast.duration / 60);
    console.log(`音频时长: ${minutes} 分钟 (${podcast.duration} 秒)`);
  }
  console.log('');

  // 2. 检查ASR原文
  console.log('=== ASR原文分析 ===');
  if (podcast.originalTranscript) {
    const transcriptLength = podcast.originalTranscript.length;
    console.log(`ASR原文长度: ${transcriptLength.toLocaleString()} 字符`);
    console.log(`ASR原文预览（前500字符）:`);
    console.log(podcast.originalTranscript.substring(0, 500));
    console.log('...');
    console.log(`ASR原文结尾（后200字符）:`);
    console.log('...');
    console.log(podcast.originalTranscript.substring(Math.max(0, transcriptLength - 200)));
    console.log('');

    // 估算应该有多少字符
    if (podcast.duration) {
      const minutes = podcast.duration / 60;
      // 正常语速：每分钟约150-200字，但ASR可能包含标点、空格等
      // 保守估算：每分钟约100-150字符（包括标点、空格、换行等）
      const estimatedMinChars = Math.round(minutes * 100);
      const estimatedMaxChars = Math.round(minutes * 200);
      console.log(`📊 字符数估算:`);
      console.log(`   音频时长: ${minutes.toFixed(1)} 分钟`);
      console.log(`   估算字符数: ${estimatedMinChars.toLocaleString()} - ${estimatedMaxChars.toLocaleString()} 字符`);
      console.log(`   实际字符数: ${transcriptLength.toLocaleString()} 字符`);
      
      if (transcriptLength < estimatedMinChars * 0.5) {
        console.log(`   ⚠️ 警告: 实际字符数远低于估算值，可能存在问题！`);
        console.log(`   可能原因:`);
        console.log(`     1. 部分ASR片段转写失败`);
        console.log(`     2. ASR片段拼接不完整`);
        console.log(`     3. ASR转写质量低，很多片段返回空文本`);
      } else if (transcriptLength < estimatedMinChars) {
        console.log(`   ⚠️ 注意: 实际字符数略低于估算值，可能部分片段转写质量较低`);
      } else {
        console.log(`   ✅ 字符数在合理范围内`);
      }
    }

    // 检查是否有明显的截断
    const lines = podcast.originalTranscript.split('\n');
    console.log(`\n   总行数: ${lines.length}`);
    if (lines.length > 0) {
      console.log(`   第一行: ${lines[0].substring(0, 100)}...`);
      console.log(`   最后一行: ${lines[lines.length - 1].substring(0, 100)}...`);
    }
  } else {
    console.log('❌ 没有ASR原文');
  }
  console.log('');

  // 3. 检查任务队列中的ASR详细信息
  const successTask = await db.taskQueue.findFirst({
    where: {
      result: {
        path: ['id'],
        equals: podcastId
      },
      status: 'READY'
    },
    orderBy: { createdAt: 'desc' }
  });

  if (successTask && successTask.metrics) {
    const metrics = successTask.metrics as any;
    console.log('=== 任务Metrics分析 ===');
    console.log(`任务ID: ${successTask.id}`);
    
    if (metrics.asrSegmentsCount) {
      console.log(`ASR片段数: ${metrics.asrSegmentsCount}`);
    }
    
    if (metrics.processingSteps?.asr) {
      const asrStep = metrics.processingSteps.asr;
      console.log(`ASR步骤状态: ${asrStep.status}`);
      if (asrStep.duration) {
        console.log(`ASR耗时: ${Math.round(asrStep.duration / 1000)} 秒`);
      }
      if (asrStep.segments) {
        console.log(`ASR片段数: ${asrStep.segments}`);
      }
      if (asrStep.uploadedSegments) {
        console.log(`OSS上传成功片段数: ${asrStep.uploadedSegments}`);
      }
      if (asrStep.successfulSegments) {
        console.log(`ASR转写成功片段数: ${asrStep.successfulSegments}`);
      }
      if (asrStep.failedSegments) {
        console.log(`⚠️ ASR转写失败片段数: ${asrStep.failedSegments}`);
      }
    }
    
    console.log('\n完整Metrics:');
    console.log(JSON.stringify(metrics, null, 2));
  }
  console.log('');

  // 4. 检查AudioCache中的ASR片段
  if (podcast.audioUrl) {
    const audioCache = await db.audioCache.findFirst({
      where: {
        OR: [
          { audioUrl: podcast.audioUrl },
          { originalUrl: podcast.sourceUrl }
        ]
      }
    });

    if (audioCache && audioCache.segments) {
      console.log('=== AudioCache中的ASR片段 ===');
      const segments = audioCache.segments as string[];
      console.log(`片段总数: ${segments.length}`);
      
      let totalSegmentChars = 0;
      let emptySegments = 0;
      segments.forEach((seg, i) => {
        try {
          const segmentData = JSON.parse(seg);
          const text = segmentData.text || '';
          totalSegmentChars += text.length;
          if (!text || text.trim() === '') {
            emptySegments++;
            console.log(`  ⚠️ 片段 ${i + 1} 为空文本`);
          }
        } catch (e) {
          console.log(`  ⚠️ 片段 ${i + 1} 解析失败: ${seg.substring(0, 100)}`);
        }
      });
      
      console.log(`片段总字符数: ${totalSegmentChars.toLocaleString()} 字符`);
      console.log(`空片段数: ${emptySegments}`);
      
      if (podcast.originalTranscript) {
        const transcriptLength = podcast.originalTranscript.length;
        console.log(`\n对比:`);
        console.log(`  originalTranscript长度: ${transcriptLength.toLocaleString()} 字符`);
        console.log(`  片段总字符数: ${totalSegmentChars.toLocaleString()} 字符`);
        if (Math.abs(transcriptLength - totalSegmentChars) > 100) {
          console.log(`  ⚠️ 差异较大，可能存在拼接问题`);
        } else {
          console.log(`  ✅ 字符数基本一致`);
        }
      }
    } else {
      console.log('⚠️ 未找到AudioCache记录');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
}

const podcastId = process.argv[2] || 'cmiwqr6e500045yb5yiakz1pe';
checkAsrTranscript(podcastId).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('查询失败:', error);
  process.exit(1);
});

