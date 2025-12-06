// 手动加载环境变量
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const envFile = readFileSync(join(__dirname, '../.env'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0 && !key.startsWith('#')) {
      const value = values.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  });
} catch (e) {
  // .env 文件不存在或无法读取，使用系统环境变量
}

import { processAudioInternal } from '../src/server/audio-processor';

async function diagnosePodcastASR(podcastUrl: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 播客ASR诊断工具');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`播客链接: ${podcastUrl}\n`);
  
  try {
    console.log('开始处理播客...\n');
    const startTime = Date.now();
    
    const result = await processAudioInternal(podcastUrl);
    
    const duration = Date.now() - startTime;
    const seconds = Math.floor(duration / 1000);
    
    console.log('\n✅ 处理完成！');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`处理时间: ${seconds}秒`);
    console.log(`播客ID: ${result?.id || '未知'}`);
    console.log(`标题: ${result?.title || '未知'}`);
    console.log(`状态: ${result?.status || '未知'}`);
    console.log(`ASR原文长度: ${result?.transcript?.length || 0} 字符`);
    console.log(`总结长度: ${result?.summary?.length || 0} 字符`);
    
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || '';
    
    console.error('\n❌ 处理失败！');
    console.error('═══════════════════════════════════════════════════════════\n');
    console.error('错误信息:', errorMessage);
    
    // 分析错误类型
    if (errorMessage.includes('所有分段均无有效文本')) {
      console.error('\n🔍 错误分析:');
      console.error('  - 所有ASR分段都返回了空文本');
      console.error('  - 可能原因：');
      console.error('    1. OSS URL无法访问（ASR API无法下载音频文件）');
      console.error('    2. 音频文件格式问题（ASR API不支持该格式）');
      console.error('    3. 音频文件为空或损坏');
      console.error('    4. ASR API调用失败（所有分段都失败）');
      console.error('    5. 网络问题（ASR API无法连接到OSS）');
    } else if (errorMessage.includes('url error')) {
      console.error('\n🔍 错误分析:');
      console.error('  - ASR API返回URL错误');
      console.error('  - 可能原因：');
      console.error('    1. OSS URL格式不正确');
      console.error('    2. OSS URL已过期（签名URL）');
      console.error('    3. OSS bucket权限设置问题');
      console.error('    4. ASR API无法访问OSS URL（跨域或网络问题）');
    } else if (errorMessage.includes('ASR转写失败')) {
      console.error('\n🔍 错误分析:');
      console.error('  - ASR转写过程失败');
      console.error('  - 请查看上面的详细错误信息');
    }
    
    if (errorStack) {
      console.error('\n错误堆栈:');
      console.error(errorStack.substring(0, 1000));
    }
    
    process.exit(1);
  }
}

// 从命令行参数获取播客链接
const args = process.argv.slice(2);
const podcastUrl = args[0] || 'https://www.xiaoyuzhoufm.com/episode/6362fe334c4aa259b3630766';

if (!podcastUrl) {
  console.error('请提供播客链接');
  process.exit(1);
}

diagnosePodcastASR(podcastUrl);

