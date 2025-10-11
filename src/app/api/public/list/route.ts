import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'latest'; // latest, hot, topics
    const topic = searchParams.get('topic');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let whereClause: any = {};
    
    if (type === 'topics' && topic) {
      whereClause.topic = { name: { contains: topic, mode: 'insensitive' } };
    }

    let orderBy: any = { updatedAt: 'desc' };
    
    if (type === 'hot') {
      // 简单的热度排序：按更新时间 + 标题长度（假设更长的标题可能更受欢迎）
      orderBy = [
        { updatedAt: 'desc' },
        { title: 'asc' }
      ];
    }

    // 先查Podcast表
    const [podcastItems, podcastTotal] = await Promise.all([
      prisma.podcast.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          showAuthor: true,
          publishedAt: true,
          audioUrl: true,
          sourceUrl: true,
          summary: true,
          topic: { select: { name: true } },
          updatedAt: true
        },
        orderBy,
        skip: offset,
        take: limit
      }),
      prisma.podcast.count({ where: whereClause })
    ]);

    // 如果Podcast表没有数据，查AudioCache表
    let items = podcastItems;
    let total = podcastTotal;

    if (podcastTotal === 0) {
      const [audioCacheItems, audioCacheTotal] = await Promise.all([
        prisma.audioCache.findMany({
          where: {
            // 只返回完全处理完成的播客
            script: { not: null },
            report: { not: null },
            title: { not: null }
          },
          select: {
            id: true,
            title: true,
            author: true,
            publishedAt: true,
            audioUrl: true,
            summary: true,
            updatedAt: true
          },
          orderBy: { updatedAt: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.audioCache.count({
          where: {
            // 只计算完全处理完成的播客
            script: { not: null },
            report: { not: null },
            title: { not: null }
          }
        })
      ]);

      items = audioCacheItems.map(item => ({
        id: item.id,
        title: item.title || '未知标题',
        showAuthor: item.author || '未知作者',
        publishedAt: item.publishedAt,
        audioUrl: item.audioUrl,
        sourceUrl: item.audioUrl, // 暂时使用audioUrl，后续会改进
        summary: item.summary,
        topic: null,
        updatedAt: item.updatedAt
      }));
      total = audioCacheTotal;
    }

    return NextResponse.json({
      items: items.map(item => ({
        id: item.id,
        title: item.title,
        author: item.showAuthor,
        publishedAt: item.publishedAt,
        audioUrl: item.audioUrl,
        originalUrl: item.sourceUrl,
        summary: item.summary,
        topic: item.topic?.name || null,
        updatedAt: item.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('List error:', error);
    return NextResponse.json(
      { error: '获取列表失败' },
      { status: 500 }
    );
  }
}