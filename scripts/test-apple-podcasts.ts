import { parseUniversalPodcast } from '../src/server/parsers/universal-podcast-parser';
import { processAudioInternal } from '../src/server/audio-processor';

async function testApplePodcasts(url: string, fullProcess: boolean = false) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🍎 测试 Apple Podcasts 链接解析');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`播客链接: ${url}\n`);

  try {
    // 步骤1: 解析播客元数据
    console.log('步骤1: 解析播客元数据...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const startTime = Date.now();
    const meta = await parseUniversalPodcast(url);
    const parseTime = Date.now() - startTime;
    
    console.log(`✅ 元数据解析成功 (耗时: ${parseTime}ms)`);
    console.log(`\n📋 解析结果:`);
    console.log(`  标题: ${meta.title || '❌ 未获取'}`);
    console.log(`  播客系列: ${meta.podcastTitle || '❌ 未获取'}`);
    console.log(`  作者: ${meta.author || '❌ 未获取'}`);
    console.log(`  描述: ${meta.description ? meta.description.substring(0, 100) + '...' : '❌ 未获取'}`);
    console.log(`  发布时间: ${meta.publishedAt || '❌ 未获取'}`);
    console.log(`  数据来源: ${meta.source || '未知'}`);
    console.log(`  可信度: ${(meta.confidence * 100).toFixed(1)}%`);
    console.log(`  音频URL: ${meta.audioUrl ? '✅ 已获取' : '❌ 未获取'}`);
    
    if (meta.audioUrl) {
      console.log(`\n🎵 音频URL详情:`);
      console.log(`  URL: ${meta.audioUrl.substring(0, 150)}${meta.audioUrl.length > 150 ? '...' : ''}`);
      
      // 检查音频格式
      const audioFormat = meta.audioUrl.match(/\.(m4a|mp3|aac|wav|ogg)/i)?.[1]?.toLowerCase();
      if (audioFormat) {
        console.log(`  格式: ${audioFormat.toUpperCase()}`);
      } else {
        console.log(`  格式: 未知（URL中未包含常见音频扩展名）`);
      }
      
      // 步骤2: 测试音频URL可访问性
      console.log(`\n步骤2: 测试音频URL可访问性...`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      try {
        const headRes = await fetch(meta.audioUrl, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(15000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
            'Referer': 'https://podcasts.apple.com/',
          }
        });
        
        if (!headRes.ok) {
          console.error(`❌ 音频URL无法访问: HTTP ${headRes.status} ${headRes.statusText}`);
          console.log(`\n💡 建议:`);
          console.log(`  1. 检查音频URL是否需要特定的Referer或User-Agent`);
          console.log(`  2. 检查音频URL是否已过期`);
          console.log(`  3. 尝试使用代理接口 /api/proxy-audio`);
        } else {
          const contentLength = headRes.headers.get('content-length');
          const contentType = headRes.headers.get('content-type');
          
          if (contentLength) {
            const sizeMB = parseInt(contentLength) / (1024 * 1024);
            console.log(`✅ 音频URL可访问`);
            console.log(`  文件大小: ${sizeMB.toFixed(2)} MB`);
            
            if (sizeMB > 200) {
              console.warn(`  ⚠️  音频文件较大 (${sizeMB.toFixed(2)} MB)，处理可能需要较长时间`);
            }
          } else {
            console.log(`✅ 音频URL可访问（无法获取文件大小）`);
          }
          
          if (contentType) {
            console.log(`  内容类型: ${contentType}`);
          }
        }
      } catch (error: any) {
        console.error(`❌ 音频URL访问失败: ${error.message}`);
        console.log(`\n💡 可能原因:`);
        console.log(`  1. 网络连接问题`);
        console.log(`  2. 音频URL需要特定的请求头`);
        console.log(`  3. 音频URL已过期或无效`);
        console.log(`  4. 服务器阻止了请求`);
      }
    } else {
      console.error(`\n❌ 无法获取音频URL`);
      console.log(`\n💡 可能原因:`);
      console.log(`  1. Apple Podcasts 页面结构发生变化`);
      console.log(`  2. JSON-LD 数据中未包含音频URL`);
      console.log(`  3. 正则表达式未能匹配到音频URL`);
      console.log(`  4. 需要登录才能访问音频URL`);
    }

    // 步骤3: 如果获取到了音频URL，测试完整处理流程（可选）
    if (meta.audioUrl && fullProcess) {
      console.log(`\n步骤3: 测试完整处理流程...`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`⚠️  注意：完整处理可能需要较长时间（包括ASR、总结生成等）\n`);
      
      try {
        const processStartTime = Date.now();
        const result = await processAudioInternal(url, undefined, `test-apple-${Date.now()}`);
        const processTime = Date.now() - processStartTime;
        
        if (result) {
          console.log(`✅ 完整处理成功 (耗时: ${Math.floor(processTime / 1000)}秒)`);
          console.log(`\n📊 处理结果:`);
          if (result.summary) {
            console.log(`  总结长度: ${result.summary.length} 字符`);
            console.log(`  总结预览: ${result.summary.substring(0, 200)}...`);
          }
          if (result.outline) {
            console.log(`  大纲长度: ${result.outline.length} 字符`);
          }
        } else {
          console.error(`❌ 完整处理失败：未返回结果`);
        }
      } catch (error: any) {
        console.error(`❌ 完整处理失败: ${error.message}`);
        if (error.stack) {
          console.error(`  错误堆栈: ${error.stack.substring(0, 500)}`);
        }
      }
    } else if (meta.audioUrl && !fullProcess) {
      console.log(`\n💡 提示: 要测试完整处理流程，请使用 --full 参数`);
      console.log(`  示例: pnpm tsx scripts/test-apple-podcasts.ts "${url}" --full`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 测试总结');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const checks = [
      { name: '标题获取', value: !!meta.title },
      { name: '播客系列获取', value: !!meta.podcastTitle },
      { name: '音频URL获取', value: !!meta.audioUrl },
      { name: '数据来源识别', value: meta.source && meta.source !== 'error' },
      { name: '可信度', value: meta.confidence > 0.5 },
    ];

    checks.forEach(check => {
      const icon = check.value ? '✅' : '❌';
      console.log(`   ${icon} ${check.name}: ${check.value ? '通过' : '失败'}`);
    });

    console.log('\n✅ 测试完成！');

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack.substring(0, 1000));
    }
    process.exit(1);
  }
}

// 从命令行参数获取URL
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ 请提供 Apple Podcasts 链接');
  console.log('使用方法: pnpm tsx scripts/test-apple-podcasts.ts <url> [--full]');
  console.log('示例: pnpm tsx scripts/test-apple-podcasts.ts "https://podcasts.apple.com/..."');
  console.log('示例（完整处理）: pnpm tsx scripts/test-apple-podcasts.ts "https://podcasts.apple.com/..." --full');
  process.exit(1);
}

const url = args[0];
const fullProcess = args.includes('--full');

testApplePodcasts(url, fullProcess).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});

