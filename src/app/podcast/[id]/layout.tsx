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
    
    // 生成描述
    let description = cleanTitle;
    if (podcast.showAuthor) {
      description += ` | ${podcast.showAuthor}`;
    }
    if (podcast.topic?.name) {
      description += ` | #${podcast.topic.name}`;
    }
    if (podcast.summary) {
      // 取摘要的前150个字符作为描述
      const summaryText = podcast.summary.replace(/[#*`]/g, '').trim();
      description = summaryText.substring(0, 150) + (summaryText.length > 150 ? '...' : '');
    }

    // 获取基础URL（用于生成完整的分享链接）
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000');
    
    const url = `${baseUrl}/podcast/${id}`;

    return {
      title: `${cleanTitle} - PodHome`,
      description,
      openGraph: {
        title: cleanTitle,
        description,
        type: 'article',
        url,
        siteName: 'PodHome',
        ...(podcast.publishedAt && {
          publishedTime: new Date(podcast.publishedAt).toISOString(),
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title: cleanTitle,
        description,
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

