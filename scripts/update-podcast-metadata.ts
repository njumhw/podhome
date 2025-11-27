/**
 * 补充存量播客的作者和发布时间信息
 * 对于缺少 showAuthor 或 publishedAt 的播客，重新解析并更新
 */

import { db } from '../src/server/db';
import { parseXiaoyuzhouEpisode } from '../src/server/parsers/xiaoyuzhou-simple';

async function updatePodcastMetadata() {
  console.log('开始补充播客元数据...\n');

  try {
    // 查询所有缺少作者或发布时间的播客
    const podcasts = await db.podcast.findMany({
      where: {
        status: 'READY',
        OR: [
          { showAuthor: null },
          { publishedAt: null }
        ]
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        showAuthor: true,
        publishedAt: true
      }
    });

    console.log(`找到 ${podcasts.length} 个需要补充元数据的播客\n`);

    if (podcasts.length === 0) {
      console.log('✅ 所有播客的元数据都已完整');
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    // 批量处理，每次处理一个，避免并发过多
    for (let i = 0; i < podcasts.length; i++) {
      const podcast = podcasts[i];
      console.log(`[${i + 1}/${podcasts.length}] 处理: ${podcast.title}`);
      console.log(`  URL: ${podcast.sourceUrl}`);

      try {
        // 只处理小宇宙的链接
        if (!podcast.sourceUrl.includes('xiaoyuzhoufm.com')) {
          console.log(`  ⏭️  跳过：非小宇宙链接`);
          skipCount++;
          continue;
        }

        // 检查是否需要更新
        const needAuthor = !podcast.showAuthor;
        const needPublishedAt = !podcast.publishedAt;

        if (!needAuthor && !needPublishedAt) {
          console.log(`  ⏭️  跳过：元数据已完整`);
          skipCount++;
          continue;
        }

        // 解析播客元数据
        console.log(`  🔍 解析中...`);
        const meta = await parseXiaoyuzhouEpisode(podcast.sourceUrl);

        // 准备更新数据
        const updateData: {
          showAuthor?: string | null;
          publishedAt?: Date | null;
        } = {};

        if (needAuthor && meta.author) {
          updateData.showAuthor = meta.author.substring(0, 200).trim();
          console.log(`  ✅ 提取到作者: ${updateData.showAuthor}`);
        }

        if (needPublishedAt && meta.publishedAt) {
          try {
            updateData.publishedAt = new Date(meta.publishedAt);
            console.log(`  ✅ 提取到发布时间: ${updateData.publishedAt.toISOString()}`);
          } catch (dateError) {
            console.warn(`  ⚠️  发布时间格式无效: ${meta.publishedAt}`);
          }
        }

        // 如果有需要更新的数据，执行更新
        if (Object.keys(updateData).length > 0) {
          await db.podcast.update({
            where: { id: podcast.id },
            data: updateData
          });
          console.log(`  ✅ 更新成功`);
          successCount++;
        } else {
          console.log(`  ⚠️  未提取到新数据`);
          failCount++;
        }

        // 添加延迟，避免请求过快
        if (i < podcasts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒延迟
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ 处理失败: ${errorMessage}`);
        failCount++;
      }

      console.log(''); // 空行分隔
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('处理完成！');
    console.log(`  成功: ${successCount} 个`);
    console.log(`  失败: ${failCount} 个`);
    console.log(`  跳过: ${skipCount} 个`);
    console.log(`  总计: ${podcasts.length} 个`);
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('脚本执行失败:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

// 执行脚本
updatePodcastMetadata()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });




