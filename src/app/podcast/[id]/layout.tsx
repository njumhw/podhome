import { Metadata } from 'next';
import { db as prisma } from '@/server/db';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  try {
    // 先查Podcast表
    let podcast: any = null;
    try {
      podcast = await prisma.podcast.findFirst({
        where: { id },
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
          where: { id },
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
          // 将AudioCache的数据格式转换为与Podcast一致
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
      return {
        title: '播客不存在 - PodHome',
        description: '播客转写、总结与跨播客 QA',
      };
    }

    // 清理标题（移除作者信息）
    const cleanTitle = podcast.title.replace(/\s*[-|]\s*[^-|]+$/, '').trim();
    
    // 生成描述（确保长度合理，社交软件通常限制在200字符以内）
    let description = '';
    if (podcast.summary) {
      // 优先使用摘要作为描述，移除markdown格式，限制长度
      const summaryText = podcast.summary
        .replace(/[#*`]/g, '') // 移除markdown标记
        .replace(/\n+/g, ' ') // 将换行符替换为空格
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim();
      // 限制在160字符以内（留一些余量）
      description = summaryText.substring(0, 160) + (summaryText.length > 160 ? '...' : '');
    } else {
      // 如果没有摘要，使用标题+作者+话题
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

    // 获取基础URL（用于生成完整的分享链接）
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000');
    
    const url = `${baseUrl}/podcast/${id}`;

    return {
      // 直接使用标题，不加后缀，让社交软件更清晰地识别
      title: cleanTitle,
      description,
      openGraph: {
        // 确保标题清晰，这是社交软件识别的主要内容
        title: cleanTitle,
        description,
        type: 'article',
        url,
        siteName: 'PodHome',
        locale: 'zh_CN',
        ...(podcast.publishedAt && {
          publishedTime: new Date(podcast.publishedAt).toISOString(),
        }),
        // 图片是可选的，即使没有图片，标题和描述也能被正确识别
        // images: [
        //   {
        //     url: `${baseUrl}/og-image.png`,
        //     width: 1200,
        //     height: 630,
        //     alt: cleanTitle,
        //   },
        // ],
      },
      twitter: {
        card: 'summary',
        title: cleanTitle,
        description,
        // images: [`${baseUrl}/og-image.png`],
      },
      alternates: {
        canonical: url,
      },
    };
  } catch (error) {
    console.error('生成metadata失败:', error);
    return {
      title: '播客详情 - PodHome',
      description: '播客转写、总结与跨播客 QA',
    };
  }
}

export default function PodcastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

