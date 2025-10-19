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

    let whereClause: { id?: string; OR?: Array<{ sourceUrl?: string; audioUrl?: string }> } = {};
    
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
        transcript: true
          // report字段已删除
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
          publishedAt: audioCache.publishedAt || (audioCache.metadata as { publishedAt?: string })?.publishedAt,
          audioUrl: audioCache.audioUrl,
          sourceUrl: audioCache.audioUrl,
          summary: audioCache.summary,
          topic: audioCache.topic,
          transcript: audioCache.transcript,  // 原始ASR转录文本
          script: audioCache.script,  // 优化后的访谈记录
          report: audioCache.summary,
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

    const response = NextResponse.json({
      id: podcast.id,
      title: podcast.title,
      author: podcast.showAuthor,
      publishedAt: podcast.publishedAt,
      audioUrl: podcast.audioUrl,
      originalUrl: podcast.sourceUrl,
      summary: podcast.summary,
      topic: podcast.topic,
      script: podcast.script,
      report: podcast.summary,
      updatedAt: podcast.updatedAt
    });
    
    // 添加缓存控制头，确保不缓存
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Podcast fetch error:', error);
    
    // 检查是否是数据库连接问题
    if (error.message?.includes('Can\'t reach database server') || 
        error.message?.includes('connection pool')) {
      return NextResponse.json(
        { error: '数据库连接问题，请稍后重试' },
        { status: 503 } // Service Unavailable
      );
    }
    
    return NextResponse.json(
      { error: '获取播客详情失败' },
      { status: 500 }
    );
  }
}