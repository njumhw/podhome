import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ hits: [], notFound: false });
    }

    const searchTerm = query.trim();
    
    // 检查是否是URL
    const isUrl = searchTerm.startsWith('http');
    
    if (isUrl) {
      // 按URL搜索 - 只查Podcast表（已发布的播客）
      const cached = await prisma.podcast.findFirst({
        where: {
          AND: [
            {
              OR: [
                { sourceUrl: searchTerm },
                { audioUrl: searchTerm }
              ]
            },
            { status: 'READY' } // 只返回已发布的播客
          ]
        },
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
        }
      });
      
      if (cached) {
        return NextResponse.json({
          hits: [{
            id: cached.id,
            title: cached.title,
            author: cached.showAuthor,
            publishedAt: cached.publishedAt,
            audioUrl: cached.audioUrl,
            originalUrl: cached.sourceUrl,
            summary: cached.summary,
            topic: cached.topic?.name || null,
            updatedAt: cached.updatedAt
          }],
          notFound: false
        });
      } else {
        return NextResponse.json({
          hits: [],
          notFound: true
        });
      }
    } else {
      // 按标题/内容搜索 - 只查Podcast表（已发布的播客）
      const results = await prisma.podcast.findMany({
        where: {
          AND: [
            {
              OR: [
                { title: { contains: searchTerm, mode: 'insensitive' } },
                { showAuthor: { contains: searchTerm, mode: 'insensitive' } },
                { summary: { contains: searchTerm, mode: 'insensitive' } },
                { topic: { name: { contains: searchTerm, mode: 'insensitive' } } }
              ]
            },
            { status: 'READY' } // 只返回已发布的播客
          ]
        },
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
        orderBy: { updatedAt: 'desc' },
        take: 20
      });
      
      return NextResponse.json({
        hits: results.map(item => ({
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
        notFound: results.length === 0
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: '搜索失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}