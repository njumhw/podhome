import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 15, 60);
    const offset = Number(searchParams.get('offset')) || 0;

    const [total, likes] = await Promise.all([
      db.podcastLike.count({
        where: { userId: user.id },
      }),
      db.podcastLike.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          podcast: {
            select: {
              id: true,
              title: true,
              showAuthor: true,
              publishedAt: true,
              audioUrl: true,
              sourceUrl: true,
              summary: true,
              updatedAt: true,
              likes: true,
              topic: {
                select: { name: true },
              },
            },
          },
        },
      }),
    ]);

    const items = likes
      .filter((like) => !!like.podcast)
      .map((like) => {
        const podcast = like.podcast!;
        return {
          id: podcast.id,
          title: podcast.title,
          author: podcast.showAuthor || '未知作者',
          publishedAt: podcast.publishedAt ? podcast.publishedAt.toISOString() : null,
          audioUrl: podcast.audioUrl || '',
          originalUrl: podcast.sourceUrl || '',
          summary: podcast.summary,
          topic: podcast.topic?.name || null,
          updatedAt: podcast.updatedAt.toISOString(),
          likeCount: podcast.likes,
          likedAt: like.createdAt.toISOString(),
          podcastId: podcast.id, // 防止前端遍历时误把 raw like 数据传入
        };
      });

    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch liked podcasts:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch liked podcasts' },
      { status: error.status || 500 }
    );
  }
}


