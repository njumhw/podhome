import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url) {
      return NextResponse.json({ success: false, error: '缺少url' }, { status: 400 });
    }

    const audioCache = await prisma.audioCache.findFirst({
      where: { OR: [{ originalUrl: url }, { audioUrl: url }] },
      select: { segments: true }
    });

    const asr = (audioCache?.segments || []).join('\n\n');
    return NextResponse.json({ success: true, asr });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}



