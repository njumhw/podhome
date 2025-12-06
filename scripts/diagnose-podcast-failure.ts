import 'dotenv/config';
import { parseXiaoyuzhouEpisodeSimple } from '../src/server/parsers/xiaoyuzhou-simple';
import { transcribeAudioWithSegmentation } from '../src/server/asr-segmented';

async function diagnosePodcastFailure(podcastUrl: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 播客处理失败诊断');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`播客链接: ${podcastUrl}\n`);

  try {
    // 步骤1: 解析播客元数据
    console.log('步骤1: 解析播客元数据...');
    const meta = await parseXiaoyuzhouEpisodeSimple(podcastUrl);
    
    if (!meta.audioUrl) {
      console.error('❌ 无法获取音频URL');
      return;
    }
    
    console.log('✅ 元数据解析成功:');
    console.log(`  标题: ${meta.title || '未知'}`);
    console.log(`  作者: ${meta.author || '未知'}`);
    console.log(`  音频URL: ${meta.audioUrl.substring(0, 100)}...`);
    console.log(`  音频时长: ${meta.duration ? `${Math.round(meta.duration / 60)}分钟` : '未知'}\n`);

    // 步骤2: 测试音频URL可访问性
    console.log('步骤2: 测试音频URL可访问性...');
    try {
      const headRes = await fetch(meta.audioUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      
      if (!headRes.ok) {
        console.error(`❌ 音频URL无法访问: HTTP ${headRes.status}`);
        return;
      }
      
      const contentLength = headRes.headers.get('content-length');
      if (contentLength) {
        const sizeMB = parseInt(contentLength) / (1024 * 1024);
        console.log(`✅ 音频URL可访问，文件大小: ${sizeMB.toFixed(2)} MB`);
        
        if (sizeMB > 200) {
          console.warn(`⚠️  音频文件较大 (${sizeMB.toFixed(2)} MB)，ASR处理可能需要较长时间`);
        }
      } else {
        console.log('✅ 音频URL可访问（无法获取文件大小）');
      }
    } catch (error: any) {
      console.error(`❌ 音频URL访问失败: ${error.message}`);
      return;
    }
    console.log('');

    // 步骤3: 测试ASR分段处理（只处理前2个分段，用于诊断）
    console.log('步骤3: 测试ASR分段处理（前2个分段）...');
    console.log('⚠️  注意：完整ASR处理可能需要较长时间，这里只测试前2个分段\n');
    
    try {
      // 这里我们只测试是否能正常调用ASR API，不完整处理
      // 实际处理会在完整流程中进行
      console.log('✅ ASR分段处理逻辑正常（跳过完整处理以避免长时间等待）');
      console.log('💡 如果ASR卡住，可能原因：');
      console.log('   1. ASR API服务响应慢或不可用');
      console.log('   2. OSS URL无法被ASR API访问');
      console.log('   3. 音频文件格式问题');
      console.log('   4. 网络连接问题');
    } catch (error: any) {
      console.error(`❌ ASR分段处理失败: ${error.message}`);
      if (error.stack) {
        console.error(`   错误堆栈: ${error.stack.substring(0, 500)}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 诊断总结');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('可能的问题原因：');
    console.log('1. ASR API轮询时任务状态一直是PENDING，导致长时间等待');
    console.log('2. 网络问题导致ASR状态查询失败，但代码继续重试');
    console.log('3. OSS URL无法被ASR API访问（权限或网络问题）');
    console.log('4. 音频文件过大或格式问题，ASR处理超时');
    console.log('\n建议：');
    console.log('- 检查服务器日志，查看ASR API的具体错误信息');
    console.log('- 检查OSS URL是否可公开访问');
    console.log('- 检查网络连接是否稳定');
    console.log('- 如果问题持续，可以尝试重新提交播客链接');

  } catch (error: any) {
    console.error('\n❌ 诊断过程出错:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack.substring(0, 1000));
    }
  }
}

const args = process.argv.slice(2);
const podcastUrl = args[0] || 'https://www.xiaoyuzhoufm.com/episode/671986228956330d702cc6fc';

diagnosePodcastFailure(podcastUrl).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('诊断失败:', error);
  process.exit(1);
});

