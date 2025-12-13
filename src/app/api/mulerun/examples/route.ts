/**
 * MuleRun Example Podcasts API
 * 返回示例播客列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';

/**
 * GET - 获取示例播客列表
 */
export async function GET(req: NextRequest) {
  try {
    // 根据标题查找示例播客
    // 这些是之前用户提到的三个示例播客
    const exampleTitles = [
      '014 对谈赵林',
      'OpenAI首席研究官Mark Chen',
      'E211 和张云帆聊聊：怎样不靠运气赚钱',
    ];

    const podcasts = await db.podcast.findMany({
      where: {
        status: 'READY',
        OR: exampleTitles.map(title => ({
          title: { contains: title },
        })),
      },
      select: {
        id: true,
        title: true,
        showAuthor: true,
        summary: true,
        reportOutline: true,
        status: true,
        sourceUrl: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 3,
    });

    // 如果找不到，返回一些最新的播客作为示例
    if (podcasts.length === 0) {
      const latestPodcasts = await db.podcast.findMany({
        where: {
          status: 'READY',
        },
        select: {
          id: true,
          title: true,
          showAuthor: true,
          summary: true,
          reportOutline: true,
          status: true,
          sourceUrl: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 3,
      });

      return NextResponse.json({
        podcasts: latestPodcasts,
      });
    }

    return NextResponse.json({
      podcasts,
    });
  } catch (error) {
    console.error('[MuleRun] 获取示例播客失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

