import { db } from '../src/server/db';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// 加载环境变量
const envPath = resolve(__dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  console.warn('无法读取.env文件');
}

async function reviewPodcastDetailed(podcastId: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 播客处理过程详细回顾（成功案例）');
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
  console.log(`来源URL: ${podcast.sourceUrl}`);
  console.log(`音频URL: ${podcast.audioUrl}`);
  console.log(`状态: ${podcast.status}`);
  console.log(`创建时间: ${podcast.createdAt.toLocaleString('zh-CN')}`);
  if (podcast.processingStartedAt && podcast.processingCompletedAt) {
    const duration = podcast.processingCompletedAt.getTime() - podcast.processingStartedAt.getTime();
    const minutes = Math.round(duration / 1000 / 60);
    const seconds = Math.round((duration / 1000) % 60);
    console.log(`处理耗时: ${minutes} 分 ${seconds} 秒`);
  }
  console.log('');

  // 2. 查找成功的任务
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

  if (!successTask) {
    console.log('⚠️ 未找到成功的任务记录');
    process.exit(0);
  }

  console.log('=== 成功任务详情 ===');
  console.log(`任务ID: ${successTask.id}`);
  console.log(`创建时间: ${successTask.createdAt.toLocaleString('zh-CN')}`);
  if (successTask.startedAt) {
    console.log(`开始时间: ${successTask.startedAt.toLocaleString('zh-CN')}`);
  }
  if (successTask.completedAt) {
    console.log(`完成时间: ${successTask.completedAt.toLocaleString('zh-CN')}`);
    if (successTask.startedAt) {
      const duration = successTask.completedAt.getTime() - successTask.startedAt.getTime();
      const minutes = Math.round(duration / 1000 / 60);
      const seconds = Math.round((duration / 1000) % 60);
      console.log(`总耗时: ${minutes} 分 ${seconds} 秒`);
    }
  }
  console.log('');

  // 3. 详细分析metrics
  if (successTask.metrics) {
    const metrics = successTask.metrics as any;
    console.log('=== 处理步骤详细分析 ===\n');
    
    const steps = metrics.processingSteps || {};
    
    // 显示所有步骤
    const stepOrder = ['metadata', 'download', 'asr', 'clean', 'summarize', 'report'];
    
    stepOrder.forEach(stepName => {
      if (steps[stepName]) {
        const step = steps[stepName];
        const statusIcon = step.status === 'completed' ? '✅' : 
                         step.status === 'failed' ? '❌' : 
                         step.status === 'running' ? '⏳' : '⏸️';
        
        let stepTitle = '';
        switch(stepName) {
          case 'metadata': stepTitle = '1️⃣ 元数据解析'; break;
          case 'download': stepTitle = '2️⃣ 音频下载'; break;
          case 'asr': stepTitle = '3️⃣ ASR转写（语音转文字）'; break;
          case 'clean': stepTitle = '4️⃣ 文本清洗'; break;
          case 'summarize': stepTitle = '5️⃣ AI总结生成'; break;
          case 'report': stepTitle = '6️⃣ 报告生成'; break;
          default: stepTitle = `${stepName}`;
        }
        
        console.log(`${stepTitle}`);
        console.log(`   状态: ${statusIcon} ${step.status}`);
        
        if (step.duration) {
          const stepMinutes = Math.round(step.duration / 1000 / 60);
          const stepSeconds = Math.round((step.duration / 1000) % 60);
          if (stepMinutes > 0) {
            console.log(`   耗时: ${stepMinutes} 分 ${stepSeconds} 秒`);
          } else {
            console.log(`   耗时: ${stepSeconds} 秒`);
          }
        }
        
        // ASR特定信息
        if (stepName === 'asr') {
          if (step.segments) {
            console.log(`   音频分段数: ${step.segments} 个（每段120秒）`);
          }
          if (step.uploadedSegments) {
            console.log(`   OSS上传成功: ${step.uploadedSegments} 个分段`);
          }
          if (step.transcriptLength) {
            console.log(`   转录字符数: ${step.transcriptLength.toLocaleString()} 字符`);
          }
          if (step.successfulSegments) {
            console.log(`   成功转写: ${step.successfulSegments} 个分段`);
          }
        }
        
        // 下载特定信息
        if (stepName === 'download') {
          if (step.fileSize) {
            console.log(`   文件大小: ${(step.fileSize / 1024 / 1024).toFixed(2)} MB`);
          }
          if (step.format) {
            console.log(`   音频格式: ${step.format}`);
          }
        }
        
        // 报告特定信息
        if (stepName === 'report') {
          if (step.summaryLength) {
            console.log(`   摘要长度: ${step.summaryLength} 字符`);
          }
        }
        
        if (step.error) {
          console.log(`   ❌ 错误: ${step.error.substring(0, 300)}`);
        }
        
        console.log('');
      }
    });
    
    // 总体统计
    console.log('=== 处理效率统计 ===');
    if (metrics.audioDuration && successTask.startedAt && successTask.completedAt) {
      const audioSeconds = Math.round(metrics.audioDuration / 1000);
      const audioMinutes = Math.round(audioSeconds / 60);
      const processingDuration = successTask.completedAt.getTime() - successTask.startedAt.getTime();
      const processingSeconds = Math.round(processingDuration / 1000);
      const processingMinutes = Math.round(processingSeconds / 60);
      
      console.log(`音频时长: ${audioMinutes} 分钟 (${audioSeconds} 秒)`);
      console.log(`处理耗时: ${processingMinutes} 分钟 (${processingSeconds} 秒)`);
      
      if (audioMinutes > 0 && processingMinutes > 0) {
        const speed = (audioMinutes / processingMinutes).toFixed(2);
        console.log(`处理速度: ${speed}x 实时速度 ⚡`);
      }
    }
    
    // 显示完整的metrics JSON（用于调试）
    console.log('\n=== 完整Metrics数据（JSON） ===');
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    console.log('⚠️ 任务没有存储详细的metrics数据');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ 播客处理成功！');
  console.log(`访问地址: http://localhost:4000/podcast/${podcastId}`);
  console.log('═══════════════════════════════════════════════════════════');
}

const podcastId = process.argv[2] || 'cmiwqr6e500045yb5yiakz1pe';
reviewPodcastDetailed(podcastId).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('查询失败:', error);
  console.error(error);
  process.exit(1);
});

