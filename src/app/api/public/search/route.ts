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
      // 按URL搜索 - 先查Podcast表，再查AudioCache表
      let cached = await prisma.podcast.findFirst({
        where: {
          OR: [
            { sourceUrl: searchTerm },
            { audioUrl: searchTerm }
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

      // 如果在Podcast表没找到，再查AudioCache表
      if (!cached) {
        const audioCache = await prisma.audioCache.findFirst({
          where: {
            OR: [
              { audioUrl: searchTerm },
              { originalUrl: searchTerm }
            ]
          },
          select: {
            id: true,
            title: true,
            author: true,
            audioUrl: true,
            originalUrl: true,
            summary: true,
            publishedAt: true,
            updatedAt: true
          }
        });

        if (audioCache) {
          cached = {
            id: audioCache.id,
            title: audioCache.title || '未知标题',
            showAuthor: audioCache.author || '未知作者',
            publishedAt: audioCache.publishedAt,
            audioUrl: audioCache.audioUrl,
            sourceUrl: audioCache.originalUrl || audioCache.audioUrl, // 优先使用原始URL
            summary: audioCache.summary,
            topic: null,
            updatedAt: audioCache.updatedAt
          };
        }
      }
      
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
      // 按标题/内容搜索 - 先查Podcast表
      let results = await prisma.podcast.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { showAuthor: { contains: searchTerm, mode: 'insensitive' } },
            { summary: { contains: searchTerm, mode: 'insensitive' } },
            { topic: { name: { contains: searchTerm, mode: 'insensitive' } } }
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

      // 如果Podcast表没有结果，查AudioCache表
      if (results.length === 0) {
        const audioCacheResults = await prisma.audioCache.findMany({
          where: {
            OR: [
              { title: { contains: searchTerm, mode: 'insensitive' } },
              { author: { contains: searchTerm, mode: 'insensitive' } },
              { summary: { contains: searchTerm, mode: 'insensitive' } }
            ]
          },
          select: {
            id: true,
            title: true,
            author: true,
            audioUrl: true,
            summary: true,
            publishedAt: true,
            updatedAt: true
          },
          orderBy: { updatedAt: 'desc' },
          take: 20
        });

        results = audioCacheResults.map(item => ({
          id: item.id,
          title: item.title || '未知标题',
          showAuthor: item.author || '未知作者',
          publishedAt: item.publishedAt,
          audioUrl: item.audioUrl,
          sourceUrl: item.audioUrl, // 暂时使用audioUrl
          summary: item.summary,
          topic: null,
          updatedAt: item.updatedAt
        }));
      }
      
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