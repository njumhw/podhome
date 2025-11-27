/**
 * 测试播客详情页的 Meta 标签
 * 使用方法: pnpm tsx scripts/test-podcast-meta.ts <podcast-id>
 */

import { db as prisma } from '@/server/db';

async function testPodcastMeta(podcastId: string) {
  console.log(`🔍 测试播客 Meta 标签: ${podcastId}\n`);

  try {
    // 查询播客信息（与 layout.tsx 中的逻辑一致）
    let podcast: any = null;
    
    try {
      podcast = await prisma.podcast.findFirst({
        where: { id: podcastId },
        select: {
          id: true,
          title: true,
          showAuthor: true,
          publishedAt: true,
          summary: true,
          topic: {
            select: {
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      console.warn('Podcast表查询失败，尝试AudioCache表:', error);
    }

    // 如果Podcast表没找到，查AudioCache表
    if (!podcast) {
      try {
        const audioCache = await prisma.audioCache.findFirst({
          where: { id: podcastId },
          select: {
            id: true,
            title: true,
            author: true,
            publishedAt: true,
            summary: true,
            topic: {
              select: {
                name: true,
              },
            },
          },
        });
        
        if (audioCache) {
          podcast = {
            id: audioCache.id,
            title: audioCache.title || '未知标题',
            showAuthor: audioCache.author || '未知作者',
            publishedAt: audioCache.publishedAt,
            summary: audioCache.summary,
            topic: audioCache.topic,
          };
        }
      } catch (error) {
        console.warn('AudioCache表查询失败:', error);
      }
    }

    if (!podcast) {
      console.error('❌ 未找到播客');
      return;
    }

    console.log('📋 播客信息:');
    console.log(`   标题: ${podcast.title}`);
    console.log(`   作者: ${podcast.showAuthor || '未知'}`);
    console.log(`   话题: ${podcast.topic?.name || '无'}`);
    console.log(`   发布时间: ${podcast.publishedAt ? new Date(podcast.publishedAt).toLocaleString('zh-CN') : '未知'}`);
    console.log(`   摘要: ${podcast.summary ? podcast.summary.substring(0, 100) + '...' : '无'}\n`);

    // 清理标题（与 layout.tsx 中的逻辑一致）
    const cleanTitle = podcast.title.replace(/\s*[-|]\s*[^-|]+$/, '').trim();
    
    // 生成描述（与 layout.tsx 中的逻辑一致）
    let description = '';
    if (podcast.summary) {
      const summaryText = podcast.summary
        .replace(/[#*`]/g, '') // 移除markdown标记
        .replace(/\n+/g, ' ') // 将换行符替换为空格
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim();
      // 限制在160字符以内（留一些余量）
      description = summaryText.substring(0, 160) + (summaryText.length > 160 ? '...' : '');
    } else {
      description = cleanTitle;
      if (podcast.showAuthor) {
        description += ` | ${podcast.showAuthor}`;
      }
      if (podcast.topic?.name) {
        description += ` | #${podcast.topic.name}`;
      }
      // 确保总长度不超过160字符
      if (description.length > 160) {
        description = description.substring(0, 157) + '...';
      }
    }

    // 获取基础URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000');
    
    const url = `${baseUrl}/podcast/${podcastId}`;

    console.log('📝 生成的 Meta 标签:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`<title>${cleanTitle}</title>`);
    console.log(`<meta name="description" content="${description}" />\n`);
    
    console.log('Open Graph 标签:');
    console.log(`<meta property="og:title" content="${cleanTitle}" />`);
    console.log(`<meta property="og:description" content="${description}" />`);
    console.log(`<meta property="og:type" content="article" />`);
    console.log(`<meta property="og:url" content="${url}" />`);
    console.log(`<meta property="og:site_name" content="PodHome" />`);
    console.log(`<meta property="og:locale" content="zh_CN" />`);
    if (podcast.publishedAt) {
      console.log(`<meta property="article:published_time" content="${new Date(podcast.publishedAt).toISOString()}" />`);
    }
    console.log('');
    
    console.log('Twitter Card 标签:');
    console.log(`<meta name="twitter:card" content="summary" />`);
    console.log(`<meta name="twitter:title" content="${cleanTitle}" />`);
    console.log(`<meta name="twitter:description" content="${description}" />\n`);
    
    console.log('🔗 分享链接:');
    console.log(url);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 验证关键标签
    console.log('✅ 验证结果:');
    const checks = [
      { name: '标题存在', value: cleanTitle.length > 0 },
      { name: '描述存在', value: description.length > 0 },
      { name: 'URL完整', value: url.startsWith('http') },
      { name: '标题长度合理', value: cleanTitle.length <= 60 },
      { name: '描述长度合理', value: description.length <= 160 },
    ];

    checks.forEach(check => {
      const icon = check.value ? '✅' : '❌';
      console.log(`   ${icon} ${check.name}: ${check.value ? '通过' : '失败'}`);
    });

    console.log('\n💡 提示:');
    console.log('   1. 复制上面的分享链接');
    console.log('   2. 在钉钉或其他社交软件中粘贴');
    console.log('   3. 应该能看到播客标题和描述');
    console.log('   4. 如果看不到，可能需要清除社交软件的链接缓存');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 从命令行参数获取播客ID
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ 请提供播客ID');
  console.log('使用方法: pnpm tsx scripts/test-podcast-meta.ts <podcast-id>');
  console.log('示例: pnpm tsx scripts/test-podcast-meta.ts clxxx123456');
  process.exit(1);
}

const podcastId = args[0];
testPodcastMeta(podcastId).catch(console.error);

