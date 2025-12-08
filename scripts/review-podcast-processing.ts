import { db } from '../src/server/db';

async function reviewPodcastProcessing(podcastId: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 播客处理过程回顾（成功案例）');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`播客ID: ${podcastId}\n`);

  // 1. 查找播客记录
  const podcast = await db.podcast.findUnique({
    where: { id: podcastId }
  });

  console.log('=== 1. 播客基本信息 ===');
  if (podcast) {
    console.log(`✅ 找到播客记录`);
    console.log(`   标题: ${podcast.title || '未设置'}`);
    console.log(`   作者: ${podcast.author || '未设置'}`);
    console.log(`   状态: ${podcast.status}`);
    console.log(`   来源URL: ${podcast.sourceUrl || '未设置'}`);
    console.log(`   音频URL: ${podcast.audioUrl || '未设置'}`);
    console.log(`   创建时间: ${podcast.createdAt.toLocaleString('zh-CN')}`);
    console.log(`   更新时间: ${podcast.updatedAt.toLocaleString('zh-CN')}`);
    if (podcast.processingStartedAt) {
      console.log(`   处理开始时间: ${podcast.processingStartedAt.toLocaleString('zh-CN')}`);
    }
    if (podcast.processingCompletedAt) {
      console.log(`   处理完成时间: ${podcast.processingCompletedAt.toLocaleString('zh-CN')}`);
      if (podcast.processingStartedAt) {
        const duration = podcast.processingCompletedAt.getTime() - podcast.processingStartedAt.getTime();
        const minutes = Math.round(duration / 1000 / 60);
        const seconds = Math.round((duration / 1000) % 60);
        console.log(`   总处理耗时: ${minutes} 分钟 ${seconds} 秒`);
      }
    }
    console.log(`   有摘要: ${podcast.summary ? `是 (${podcast.summary.length} 字符)` : '否'}`);
    console.log(`   有转录: ${podcast.transcript ? `是 (${podcast.transcript.length} 字符)` : '否'}`);
    console.log(`   有原始转录: ${podcast.originalTranscript ? `是 (${podcast.originalTranscript.length} 字符)` : '否'}`);
  } else {
    console.log('❌ 未找到播客记录');
    process.exit(1);
  }
  console.log('');

  // 2. 查找任务队列记录
  const tasks = await db.taskQueue.findMany({
    where: {
      OR: [
        {
          data: {
            path: ['url'],
            equals: podcast.sourceUrl
          }
        },
        {
          result: {
            path: ['id'],
            equals: podcastId
          }
        }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('=== 2. 任务队列记录 ===');
  if (tasks.length > 0) {
    console.log(`找到 ${tasks.length} 个相关任务\n`);
    tasks.forEach((task, i) => {
      console.log(`任务 ${i + 1}:`);
      console.log(`  ID: ${task.id}`);
      console.log(`  类型: ${task.type}`);
      console.log(`  状态: ${task.status}`);
      console.log(`  创建时间: ${task.createdAt.toLocaleString('zh-CN')}`);
      if (task.startedAt) {
        console.log(`  开始时间: ${task.startedAt.toLocaleString('zh-CN')}`);
      }
      if (task.completedAt) {
        console.log(`  完成时间: ${task.completedAt.toLocaleString('zh-CN')}`);
        if (task.startedAt) {
          const duration = task.completedAt.getTime() - task.startedAt.getTime();
          const minutes = Math.round(duration / 1000 / 60);
          const seconds = Math.round((duration / 1000) % 60);
          console.log(`  总耗时: ${minutes} 分 ${seconds} 秒`);
        }
      }
      
      if (task.error) {
        console.log(`  ❌ 错误: ${task.error.substring(0, 500)}${task.error.length > 500 ? '...' : ''}`);
      }
      
      if (task.metrics) {
        const metrics = task.metrics as any;
        console.log(`  📊 处理指标:`);
        if (metrics.processingSteps) {
          const steps = metrics.processingSteps as any;
          console.log(`    处理步骤详情:`);
          Object.keys(steps).forEach(step => {
            const stepData = steps[step];
            if (stepData.status) {
              const statusIcon = stepData.status === 'completed' ? '✅' : 
                               stepData.status === 'failed' ? '❌' : 
                               stepData.status === 'running' ? '⏳' : '⏸️';
              console.log(`      ${statusIcon} ${step}: ${stepData.status}`);
              if (stepData.duration) {
                const stepMinutes = Math.round(stepData.duration / 1000 / 60);
                const stepSeconds = Math.round((stepData.duration / 1000) % 60);
                console.log(`         耗时: ${stepMinutes} 分 ${stepSeconds} 秒`);
              }
              if (stepData.error) {
                console.log(`         错误: ${stepData.error.substring(0, 200)}`);
              }
              // 显示ASR相关详细信息
              if (step === 'asr' && stepData.segments) {
                console.log(`         分段数: ${stepData.segments}`);
              }
              if (step === 'asr' && stepData.transcriptLength) {
                console.log(`         转录字符数: ${stepData.transcriptLength}`);
              }
            }
          });
        }
        
        // 显示总体统计
        if (metrics.totalDuration) {
          console.log(`    总处理时长: ${Math.round(metrics.totalDuration / 1000 / 60)} 分钟`);
        }
        if (metrics.audioDuration) {
          console.log(`    音频时长: ${Math.round(metrics.audioDuration / 1000 / 60)} 分钟`);
        }
      }
      console.log('');
    });
  } else {
    console.log('⚠️ 未找到任务记录（可能使用了旧的处理方式）');
  }
  console.log('');

  // 3. 处理流程详细分析
  console.log('=== 3. 处理流程详细分析 ===');
  if (tasks.length > 0) {
    const latestTask = tasks[0];
    if (latestTask.status === 'READY' && latestTask.metrics) {
      const metrics = latestTask.metrics as any;
      const steps = metrics.processingSteps || {};
      
      console.log('✅ 处理成功！各步骤详情：\n');
      
      // 步骤1: 元数据解析
      if (steps.metadata) {
        const meta = steps.metadata;
        console.log('1️⃣ 元数据解析');
        console.log(`   状态: ${meta.status === 'completed' ? '✅ 成功' : meta.status}`);
        if (meta.duration) {
          console.log(`   耗时: ${Math.round(meta.duration / 1000)} 秒`);
        }
        console.log('');
      }
      
      // 步骤2: 音频下载
      if (steps.download) {
        const download = steps.download;
        console.log('2️⃣ 音频下载');
        console.log(`   状态: ${download.status === 'completed' ? '✅ 成功' : download.status}`);
        if (download.duration) {
          console.log(`   耗时: ${Math.round(download.duration / 1000)} 秒`);
        }
        if (download.fileSize) {
          console.log(`   文件大小: ${(download.fileSize / 1024 / 1024).toFixed(2)} MB`);
        }
        console.log('');
      }
      
      // 步骤3: ASR转写
      if (steps.asr) {
        const asr = steps.asr;
        console.log('3️⃣ ASR转写（语音转文字）');
        console.log(`   状态: ${asr.status === 'completed' ? '✅ 成功' : asr.status}`);
        if (asr.duration) {
          const asrMinutes = Math.round(asr.duration / 1000 / 60);
          const asrSeconds = Math.round((asr.duration / 1000) % 60);
          console.log(`   耗时: ${asrMinutes} 分 ${asrSeconds} 秒`);
        }
        if (asr.segments) {
          console.log(`   音频分段数: ${asr.segments} 个（每段120秒）`);
        }
        if (asr.transcriptLength) {
          console.log(`   转录字符数: ${asr.transcriptLength.toLocaleString()} 字符`);
        }
        if (asr.uploadedSegments) {
          console.log(`   OSS上传成功: ${asr.uploadedSegments} 个分段`);
        }
        console.log('');
      }
      
      // 步骤4: 文本清洗
      if (steps.clean) {
        const clean = steps.clean;
        console.log('4️⃣ 文本清洗');
        console.log(`   状态: ${clean.status === 'completed' ? '✅ 成功' : clean.status}`);
        if (clean.duration) {
          console.log(`   耗时: ${Math.round(clean.duration / 1000)} 秒`);
        }
        console.log('');
      }
      
      // 步骤5: 总结生成
      if (steps.summarize) {
        const summarize = steps.summarize;
        console.log('5️⃣ AI总结生成');
        console.log(`   状态: ${summarize.status === 'completed' ? '✅ 成功' : summarize.status}`);
        if (summarize.duration) {
          console.log(`   耗时: ${Math.round(summarize.duration / 1000)} 秒`);
        }
        console.log('');
      }
      
      // 总体统计
      if (metrics.audioDuration && latestTask.startedAt && latestTask.completedAt) {
        const audioMinutes = Math.round(metrics.audioDuration / 1000 / 60);
        const processingDuration = latestTask.completedAt.getTime() - latestTask.startedAt.getTime();
        const processingMinutes = Math.round(processingDuration / 1000 / 60);
        const speed = audioMinutes > 0 ? (audioMinutes / processingMinutes).toFixed(2) : 'N/A';
        console.log('📈 处理效率统计:');
        console.log(`   音频时长: ${audioMinutes} 分钟`);
        console.log(`   处理耗时: ${processingMinutes} 分钟`);
        console.log(`   处理速度: ${speed}x 实时速度 ⚡`);
      }
    }
  }
  console.log('');

  // 4. 处理时间线
  console.log('=== 4. 处理时间线 ===');
  if (tasks.length > 0) {
    const sortedTasks = [...tasks].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    sortedTasks.forEach((task, i) => {
      const time = task.createdAt.toLocaleString('zh-CN');
      const status = task.status === 'READY' ? '✅' : task.status === 'FAILED' ? '❌' : task.status === 'RUNNING' ? '⏳' : '⏸️';
      console.log(`${i + 1}. ${time} - ${status} ${task.status} (${task.type})`);
      if (task.completedAt && task.startedAt) {
        const duration = task.completedAt.getTime() - task.startedAt.getTime();
        const minutes = Math.round(duration / 1000 / 60);
        const seconds = Math.round((duration / 1000) % 60);
        console.log(`   耗时: ${minutes} 分 ${seconds} 秒`);
      }
    });
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📝 总结');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (podcast.status === 'READY') {
    console.log('✅ 播客处理成功！');
    console.log(`   - 可以访问: http://localhost:4000/podcast/${podcastId}`);
    console.log(`   - 有完整摘要和转录文本`);
  } else {
    console.log(`⚠️ 播客状态: ${podcast.status}`);
  }
}

const podcastId = process.argv[2] || 'cmiwqr6e500045yb5yiakz1pe';
reviewPodcastProcessing(podcastId).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('查询失败:', error);
  process.exit(1);
});
