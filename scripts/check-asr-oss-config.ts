import { db } from '../src/server/db';
import { uploadToOssAndGetPublicUrl } from '../src/server/storage';

async function checkAsrOssConfig() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 ASR和OSS配置检查');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. 检查ASR模型配置
  console.log('1. 检查ASR模型配置...');
  const asrModel = process.env.QWEN_ASR_MODEL || 'fun-asr';
  console.log(`   ASR模型: ${asrModel}`);
  if (asrModel !== 'fun-asr') {
    console.warn(`   ⚠️  当前使用的不是 fun-asr，可能影响处理`);
  } else {
    console.log(`   ✅ 使用 fun-asr 模型（正确）`);
  }
  console.log('');

  // 2. 检查OSS配置
  console.log('2. 检查OSS配置...');
  const ossBucket = process.env.ALIYUN_OSS_BUCKET;
  const ossRegion = process.env.ALIYUN_OSS_REGION;
  const ossAccessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const ossAccessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  
  console.log(`   OSS Bucket: ${ossBucket || '未设置'}`);
  console.log(`   OSS Region: ${ossRegion || '未设置'}`);
  console.log(`   AccessKeyId: ${ossAccessKeyId ? '已设置' : '未设置'}`);
  console.log(`   AccessKeySecret: ${ossAccessKeySecret ? '已设置' : '未设置'}`);
  
  if (!ossBucket || !ossRegion || !ossAccessKeyId || !ossAccessKeySecret) {
    console.error('   ❌ OSS配置不完整');
    return;
  }
  console.log('   ✅ OSS配置完整');
  console.log('');

  // 3. 测试OSS URL生成和可访问性
  console.log('3. 测试OSS URL生成和可访问性...');
  try {
    // 创建一个小的测试文件
    const testContent = Buffer.from('test');
    const testPath = `test/asr-config-check-${Date.now()}.txt`;
    
    console.log(`   上传测试文件到OSS: ${testPath}`);
    const testUrl = await uploadToOssAndGetPublicUrl(testPath, testContent, 'text/plain');
    
    if (!testUrl) {
      console.error('   ❌ OSS上传失败，无法生成URL');
      return;
    }
    
    console.log(`   ✅ OSS URL生成成功: ${testUrl.substring(0, 100)}...`);
    
    // 测试URL可访问性
    try {
      const testRes = await fetch(testUrl, { 
        method: 'HEAD', 
        signal: AbortSignal.timeout(10000) 
      });
      
      if (testRes.ok) {
        console.log(`   ✅ OSS URL可访问 (HTTP ${testRes.status})`);
        
        // 检查是否是公共URL还是签名URL
        if (testUrl.includes('?')) {
          console.warn(`   ⚠️  使用的是签名URL（包含查询参数），ASR API可能无法访问`);
          console.warn(`   建议：确保OSS bucket设置为公共读，使用公共URL`);
        } else {
          console.log(`   ✅ 使用的是公共URL（无查询参数），ASR API可以访问`);
        }
      } else {
        console.error(`   ❌ OSS URL不可访问 (HTTP ${testRes.status})`);
      }
    } catch (error: any) {
      console.error(`   ❌ OSS URL访问测试失败: ${error.message}`);
    }
  } catch (error: any) {
    console.error(`   ❌ OSS测试失败: ${error.message}`);
  }
  console.log('');

  // 4. 检查最近失败的ASR任务
  console.log('4. 检查最近失败的ASR任务...');
  try {
    const failedTasks = await db.taskQueue.findMany({
      where: {
        status: 'FAILED',
        error: {
          contains: 'ASR'
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 5
    });

    if (failedTasks.length === 0) {
      console.log('   ✅ 没有发现最近失败的ASR任务');
    } else {
      console.log(`   找到 ${failedTasks.length} 个最近失败的ASR任务：\n`);
      for (const task of failedTasks) {
        const data = task.data as any;
        const url = data?.url || '未知';
        const shortUrl = url.length > 60 ? url.substring(0, 60) + '...' : url;
        
        console.log(`   任务ID: ${task.id}`);
        console.log(`   URL: ${shortUrl}`);
        console.log(`   错误: ${task.error?.substring(0, 200)}${task.error && task.error.length > 200 ? '...' : ''}`);
        console.log(`   时间: ${task.updatedAt.toLocaleString('zh-CN')}`);
        
        // 检查metrics中的ASR信息
        if (task.metrics) {
          const metrics = task.metrics as any;
          if (metrics.processingSteps?.asr) {
            console.log(`   ASR状态: ${metrics.processingSteps.asr.status}`);
            if (metrics.processingSteps.asr.duration) {
              console.log(`   ASR耗时: ${Math.round(metrics.processingSteps.asr.duration / 1000)}秒`);
            }
          }
        }
        console.log('');
      }
    }
  } catch (error: any) {
    console.error(`   ❌ 查询失败任务失败: ${error.message}`);
  }
  console.log('');

  // 5. 检查运行中的ASR任务
  console.log('5. 检查运行中的ASR任务...');
  try {
    const runningTasks = await db.taskQueue.findMany({
      where: {
        status: 'RUNNING',
        metrics: {
          path: ['processingSteps', 'asr', 'status'],
          equals: 'running'
        } as any
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: 5
    });

    if (runningTasks.length === 0) {
      console.log('   ✅ 没有发现运行中的ASR任务');
    } else {
      console.log(`   ⚠️  找到 ${runningTasks.length} 个运行中的ASR任务：\n`);
      for (const task of runningTasks) {
        const data = task.data as any;
        const url = data?.url || '未知';
        const shortUrl = url.length > 60 ? url.substring(0, 60) + '...' : url;
        const runningTime = task.startedAt 
          ? Math.round((Date.now() - task.startedAt.getTime()) / 1000 / 60)
          : 0;
        
        console.log(`   任务ID: ${task.id}`);
        console.log(`   URL: ${shortUrl}`);
        console.log(`   已运行: ${runningTime} 分钟`);
        console.log(`   开始时间: ${task.startedAt?.toLocaleString('zh-CN')}`);
        console.log('');
      }
    }
  } catch (error: any) {
    console.error(`   ❌ 查询运行中任务失败: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 检查总结');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('建议：');
  console.log('1. 确保使用 fun-asr 模型（当前已正确）');
  console.log('2. 确保OSS bucket设置为公共读，或使用公共URL');
  console.log('3. 如果OSS URL不可访问，检查OSS权限配置');
  console.log('4. 查看服务器日志获取更详细的ASR错误信息');
}

checkAsrOssConfig().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('检查失败:', error);
  process.exit(1);
});

