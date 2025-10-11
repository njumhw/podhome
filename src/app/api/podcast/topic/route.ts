import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { z } from "zod";

const bindTopicSchema = z.object({
  podcastId: z.string(),
  topicId: z.string().optional(), // 可选，如果为空则解绑
});

// 绑定播客到主题
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { podcastId, topicId } = bindTopicSchema.parse(body);

    // 如果提供了topicId，检查主题是否存在且已审核
    if (topicId) {
      const topic = await db.topic.findUnique({
        where: { id: topicId },
        select: { id: true, approved: true }
      });

      if (!topic) {
        return Response.json({ success: false, error: '主题不存在' }, { status: 404 });
      }

      if (!topic.approved) {
        return Response.json({ success: false, error: '主题尚未审核通过' }, { status: 400 });
      }
    }

    // 并行查询两个表，提高性能
    const [podcast, audioCache] = await Promise.all([
      db.podcast.findUnique({
        where: { id: podcastId },
        select: { id: true }
      }),
      db.audioCache.findUnique({
        where: { id: podcastId },
        select: { id: true }
      })
    ]);

    if (podcast) {
      // 更新Podcast表的主题绑定
      await db.podcast.update({
        where: { id: podcastId },
        data: { topicId: topicId || null }
      });

      return Response.json({ 
        success: true, 
        message: topicId ? '主题绑定成功' : '主题解绑成功'
      });
    }

    if (audioCache) {
      // 更新AudioCache表的主题绑定
      await db.audioCache.update({
        where: { id: podcastId },
        data: { topicId: topicId || null }
      });

      return Response.json({ 
        success: true, 
        message: topicId ? '主题绑定成功' : '主题解绑成功'
      });
    }

    return Response.json({ success: false, error: '播客不存在' }, { status: 404 });
  } catch (error) {
    console.error('绑定主题失败:', error);
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: '输入数据格式错误' }, { status: 400 });
    }
    return Response.json({ success: false, error: '绑定主题失败' }, { status: 500 });
  }
}

// 获取播客的当前主题
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const podcastId = searchParams.get('podcastId');

    if (!podcastId) {
      return Response.json({ success: false, error: '缺少播客ID' }, { status: 400 });
    }

    // 首先尝试在Podcast表中查找
    let podcast = await db.podcast.findUnique({
      where: { id: podcastId },
      include: { topic: true }
    });

    if (podcast) {
      return Response.json({ 
        success: true, 
        topic: podcast.topic 
      });
    }

    // 如果Podcast表中没有，尝试在AudioCache表中查找
    const audioCache = await db.audioCache.findUnique({
      where: { id: podcastId },
      include: { topic: true }
    });

    if (!audioCache) {
      return Response.json({ success: false, error: '播客不存在' }, { status: 404 });
    }

    return Response.json({ 
      success: true, 
      topic: audioCache.topic 
    });
  } catch (error) {
    console.error('获取播客主题失败:', error);
    return Response.json({ success: false, error: '获取播客主题失败' }, { status: 500 });
  }
}
