import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const url = searchParams.get('url');
    
    if (!id && !url) {
      return NextResponse.json(
        { error: '需要提供id或url参数' },
        { status: 400 }
      );
    }

    let whereClause: any = {};
    
    if (id) {
      whereClause.id = id;
    } else if (url) {
      whereClause.OR = [
        { sourceUrl: url },
        { audioUrl: url }
      ];
    }

    // 先查Podcast表
    let podcast = await prisma.podcast.findFirst({
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
        transcript: true,
        updatedAt: true
      }
    });

    // 如果在Podcast表没找到，查AudioCache表
    if (!podcast) {
      const audioCache = await prisma.audioCache.findFirst({
        where: whereClause,
        select: {
          id: true,
          title: true,
          author: true,
          audioUrl: true,
          summary: true,
          script: true,
          report: true,
          publishedAt: true,
          metadata: true,
          updatedAt: true,
          topic: { select: { id: true, name: true, color: true } }
        }
      });

      if (audioCache) {
        podcast = {
          id: audioCache.id,
          title: audioCache.title || '未知标题',
          showAuthor: audioCache.author || '未知作者',
          publishedAt: audioCache.publishedAt || (audioCache.metadata as any)?.publishedAt,
          audioUrl: audioCache.audioUrl,
          sourceUrl: audioCache.audioUrl,
          summary: audioCache.summary,
          topic: audioCache.topic,
          transcript: audioCache.script,
          report: audioCache.report,
          updatedAt: audioCache.updatedAt
        };
      }
    }

    if (!podcast) {
      return NextResponse.json(
        { error: '播客不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: podcast.id,
      title: podcast.title,
      author: podcast.showAuthor,
      publishedAt: podcast.publishedAt,
      audioUrl: podcast.audioUrl,
      originalUrl: podcast.sourceUrl,
      summary: podcast.summary,
      topic: podcast.topic,
      script: podcast.transcript,
      report: podcast.report,
      updatedAt: podcast.updatedAt
    });
  } catch (error) {
    console.error('Podcast fetch error:', error);
    return NextResponse.json(
      { error: '获取播客详情失败' },
      { status: 500 }
    );
  }
}