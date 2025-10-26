import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';
import { z } from 'zod';

const editPodcastSchema = z.object({
  id: z.string(),
  title: z.string().min(1, '标题不能为空'),
  author: z.string().min(1, '作者不能为空'),
  publishedAt: z.string().optional(),
  summary: z.string().optional(),
  script: z.string().optional(),
});

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, author, publishedAt, summary, script } = editPodcastSchema.parse(body);

    // 检查播客是否存在
    // 先查Podcast表
    let podcast = await prisma.podcast.findUnique({
      where: { id }
    });

    if (podcast) {
      // 更新Podcast表
      const updatedPodcast = await prisma.podcast.update({
        where: { id },
        data: {
          title,
          showAuthor: author,
          publishedAt: publishedAt ? new Date(publishedAt) : null,
          summary,
          transcript: script,
        },
      });

      return NextResponse.json({ 
        success: true, 
        podcast: updatedPodcast,
        message: '播客信息更新成功'
      });
    }

    // 如果在Podcast表没找到，查AudioCache表
    const audioCache = await prisma.audioCache.findUnique({
      where: { id }
    });

    if (!audioCache) {
      return NextResponse.json({ success: false, error: '播客不存在' }, { status: 404 });
    }

    // 更新AudioCache表
    const updatedAudioCache = await prisma.audioCache.update({
      where: { id },
      data: {
        title,
        author,
        summary: summary, // 使用summary字段
        script,
        // AudioCache表没有publishedAt字段，可以存储在metadata中
        metadata: {
          ...(audioCache.metadata as any || {}),
          publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
        },
      },
    });

    return NextResponse.json({ 
      success: true, 
      podcast: updatedAudioCache,
      message: '播客信息更新成功'
    });
  } catch (error) {
    console.error('编辑播客失败:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: '编辑播客失败' }, { status: 500 });
  }
}
