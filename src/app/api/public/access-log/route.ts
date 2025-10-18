import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';

export async function POST(request: NextRequest) {
  try {
    const { podcastId, audioCacheId } = await request.json();
    
    if (!podcastId && !audioCacheId) {
      return NextResponse.json({ error: '播客ID或音频缓存ID是必需的' }, { status: 400 });
    }

    // 记录访问日志（暂时不记录用户ID）
    await prisma.accessLog.create({
      data: {
        podcastId,
        audioCacheId,
        userId: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('记录访问日志失败:', error);
    return NextResponse.json({ error: '记录访问日志失败', details: error.message }, { status: 500 });
  }
}
