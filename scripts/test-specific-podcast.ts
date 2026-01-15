import { parseXiaoyuzhouEpisode } from '../src/server/parsers/xiaoyuzhou';
import { parseXiaoyuzhouEpisode as parseSimple } from '../src/server/parsers/xiaoyuzhou-simple';

const podcastUrl = process.argv[2] || 'https://www.xiaoyuzhoufm.com/episode/695a67c3b9fb626141018acd?s=eyJ1IjoiNjVkNWM3YjZlZGNlNjcxMDRhNWI4ZmQ1In0%3D';

async function testPodcast() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 测试播客解析');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`播客链接: ${podcastUrl}\n`);

  // 测试1: 使用主解析器
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试1: 使用主解析器 (xiaoyuzhou.ts)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const startTime = Date.now();
    const meta1 = await parseXiaoyuzhouEpisode(podcastUrl);
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ 解析成功 (耗时: ${elapsed}ms)`);
    console.log(`  标题: ${meta1.title || '❌ 未获取'}`);
    console.log(`  播客系列: ${meta1.podcastTitle || '❌ 未获取'}`);
    console.log(`  作者: ${meta1.author || '❌ 未获取'}`);
    console.log(`  描述: ${meta1.description ? meta1.description.substring(0, 100) + '...' : '❌ 未获取'}`);
    console.log(`  发布时间: ${meta1.publishedAt || '❌ 未获取'}`);
    console.log(`  音频URL: ${meta1.audioUrl ? '✅ 已获取' : '❌ 未获取'}`);
    if (meta1.audioUrl) {
      console.log(`  音频URL详情: ${meta1.audioUrl.substring(0, 100)}...`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`❌ 解析失败: ${errorMessage}`);
    if (errorStack) {
      console.error(`堆栈:\n${errorStack.substring(0, 500)}`);
    }
  }

  console.log('\n');

  // 测试2: 使用简化解析器
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试2: 使用简化解析器 (xiaoyuzhou-simple.ts)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const startTime = Date.now();
    const meta2 = await parseSimple(podcastUrl);
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ 解析成功 (耗时: ${elapsed}ms)`);
    console.log(`  标题: ${meta2.title || '❌ 未获取'}`);
    console.log(`  播客系列: ${meta2.podcastTitle || '❌ 未获取'}`);
    console.log(`  作者: ${meta2.author || '❌ 未获取'}`);
    console.log(`  描述: ${meta2.description ? meta2.description.substring(0, 100) + '...' : '❌ 未获取'}`);
    console.log(`  发布时间: ${meta2.publishedAt || '❌ 未获取'}`);
    console.log(`  音频URL: ${meta2.audioUrl ? '✅ 已获取' : '❌ 未获取'}`);
    if (meta2.audioUrl) {
      console.log(`  音频URL详情: ${meta2.audioUrl.substring(0, 100)}...`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`❌ 解析失败: ${errorMessage}`);
    if (errorStack) {
      console.error(`堆栈:\n${errorStack.substring(0, 500)}`);
    }
  }

  // 测试3: 尝试去掉查询参数
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试3: 去掉查询参数后测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const urlWithoutQuery = podcastUrl.split('?')[0];
    console.log(`清理后的URL: ${urlWithoutQuery}\n`);
    
    const startTime = Date.now();
    const meta3 = await parseXiaoyuzhouEpisode(urlWithoutQuery);
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ 解析成功 (耗时: ${elapsed}ms)`);
    console.log(`  标题: ${meta3.title || '❌ 未获取'}`);
    console.log(`  音频URL: ${meta3.audioUrl ? '✅ 已获取' : '❌ 未获取'}`);
    if (meta3.audioUrl) {
      console.log(`  音频URL详情: ${meta3.audioUrl.substring(0, 100)}...`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ 解析失败: ${errorMessage}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('测试完成');
  console.log('═══════════════════════════════════════════════════════════\n');
}

testPodcast().catch(console.error);
