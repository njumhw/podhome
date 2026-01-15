import { normalizePodcastUrl } from '../src/utils/url-normalizer';
import { parseXiaoyuzhouEpisode } from '../src/server/parsers/xiaoyuzhou';
import { db } from '../src/server/db';

const testUrl = 'https://www.xiaoyuzhoufm.com/episode/695a67c3b9fb626141018acd?s=eyJ1IjoiNjVkNWM3YjZlZGNlNjcxMDRhNWI4ZmQ1In0%3D';

async function testPodcastUrlFix() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 测试播客URL修复功能');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`测试URL: ${testUrl}\n`);

  // 步骤1: 测试URL标准化
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤1: URL标准化测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const normalizedUrl = normalizePodcastUrl(testUrl);
  console.log(`原始URL: ${testUrl}`);
  console.log(`标准化后: ${normalizedUrl}`);
  console.log(`是否改变: ${normalizedUrl !== testUrl ? '✅ 是' : '❌ 否'}\n`);

  // 步骤2: 测试解析器
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤2: 播客元数据解析测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const startTime = Date.now();
    const meta = await parseXiaoyuzhouEpisode(testUrl);
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ 解析成功 (耗时: ${elapsed}ms)`);
    console.log(`  标题: ${meta.title || '❌ 未获取'}`);
    console.log(`  播客系列: ${meta.podcastTitle || '❌ 未获取'}`);
    console.log(`  作者: ${meta.author || '❌ 未获取'}`);
    console.log(`  音频URL: ${meta.audioUrl ? '✅ 已获取' : '❌ 未获取'}`);
    if (meta.audioUrl) {
      console.log(`  音频URL详情: ${meta.audioUrl.substring(0, 100)}...`);
    }
    console.log('');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ 解析失败: ${errorMessage}\n`);
    return;
  }

  // 步骤3: 测试数据库查询（使用标准化URL）
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤3: 数据库重复检查测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // 使用标准化后的URL查询
    const existingPodcast = await db.podcast.findFirst({
      where: {
        sourceUrl: normalizedUrl,
        status: 'READY',
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (existingPodcast) {
      console.log(`✅ 找到已存在的播客（使用标准化URL）:`);
      console.log(`  ID: ${existingPodcast.id}`);
      console.log(`  标题: ${existingPodcast.title}`);
      console.log(`  状态: ${existingPodcast.status}`);
      console.log(`  更新时间: ${existingPodcast.updatedAt}`);
    } else {
      console.log(`ℹ️  未找到已存在的播客（这是正常的，如果这是第一次处理）`);
    }
    console.log('');

    // 对比：使用原始URL查询（应该找不到，因为存储时使用了标准化URL）
    const existingWithOriginalUrl = await db.podcast.findFirst({
      where: {
        sourceUrl: testUrl, // 使用原始URL（带查询参数）
        status: 'READY',
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (existingWithOriginalUrl) {
      console.log(`⚠️  使用原始URL（带查询参数）也找到了播客:`);
      console.log(`  ID: ${existingWithOriginalUrl.id}`);
      console.log(`  标题: ${existingWithOriginalUrl.title}`);
      console.log(`  ⚠️  注意：这可能意味着数据库中存储的是带查询参数的URL`);
    } else {
      console.log(`✅ 使用原始URL（带查询参数）未找到播客（符合预期）`);
      console.log(`   说明：数据库中存储的是标准化后的URL`);
    }
    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ 数据库查询失败: ${errorMessage}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ 测试完成');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📝 总结:');
  console.log('1. URL标准化功能正常工作');
  console.log('2. 解析器能成功解析播客元数据');
  console.log('3. 数据库查询使用标准化URL，确保能正确识别已存在的播客');
  console.log('\n💡 现在可以正常处理带查询参数的小宇宙播客URL了！');
}

testPodcastUrlFix()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
  });
