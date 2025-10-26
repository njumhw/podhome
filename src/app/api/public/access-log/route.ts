import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';

export async function POST(request: NextRequest) {
  try {
    const { podcastId, audioCacheId } = await request.json();
    
    // 统一使用podcastId，如果传入的是audioCacheId，需要转换为podcastId
    let finalPodcastId = podcastId;
    
    if (!finalPodcastId && audioCacheId) {
      // 如果只有audioCacheId，尝试从AudioCache表找到对应的Podcast
      const audioCache = await prisma.audioCache.findUnique({
        where: { id: audioCacheId },
        select: { audioUrl: true }
      });
      
      if (audioCache) {
        // 根据audioUrl找到对应的Podcast
        const podcast = await prisma.podcast.findFirst({
          where: { audioUrl: audioCache.audioUrl },
          select: { id: true }
        });
        
        if (podcast) {
          finalPodcastId = podcast.id;
        }
      }
    }
    
    if (!finalPodcastId) {
      return NextResponse.json({ error: '播客ID是必需的' }, { status: 400 });
    }

    // 记录访问日志（只使用podcastId）
    await prisma.accessLog.create({
      data: {
        podcastId: finalPodcastId,
        audioCacheId: null, // 不再使用audioCacheId
        userId: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('记录访问日志失败:', error);
    return NextResponse.json({ error: '记录访问日志失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
