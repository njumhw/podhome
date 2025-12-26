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
    // 根据ID查找示例播客
    const exampleIds = [
      'cmjlt3jhm000gly8izc6i1z86',
      'cmjl2axe90005lyuqvpj52oes',
      'cmie7fjg2002glymxlejtstr0',
    ];

    const podcasts = await db.podcast.findMany({
      where: {
        status: 'READY',
        id: { in: exampleIds },
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
      // 按照exampleIds的顺序排序
    });

    // 按照exampleIds的顺序排序
    const sortedPodcasts = exampleIds
      .map(id => podcasts.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    // 如果找不到，返回一些最新的播客作为示例
    if (sortedPodcasts.length === 0) {
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
      podcasts: sortedPodcasts,
    });
  } catch (error) {
    console.error('[MuleRun] 获取示例播客失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

