import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { z } from "zod";

const createTopicSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  color: z.string().optional(),
});

const updateTopicSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  approved: z.boolean().optional(),
});

// 获取所有主题
export async function GET() {
  try {
    const topics = await db.topic.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { podcasts: true }
        }
      }
    });

    return Response.json({ success: true, topics });
  } catch (error) {
    console.error('获取主题失败:', error);
    return Response.json({ success: false, error: '获取主题失败' }, { status: 500 });
  }
}

// 创建新主题
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, color } = createTopicSchema.parse(body);

    // 检查主题名称是否已存在
    const existingTopic = await db.topic.findUnique({
      where: { name }
    });

    if (existingTopic) {
      return Response.json({ success: false, error: '主题名称已存在' }, { status: 400 });
    }

    const topic = await db.topic.create({
      data: {
        name,
        description,
        color,
        approved: false // 新主题需要审核
      }
    });

    return Response.json({ success: true, topic });
  } catch (error) {
    console.error('创建主题失败:', error);
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: '输入数据格式错误' }, { status: 400 });
    }
    return Response.json({ success: false, error: '创建主题失败' }, { status: 500 });
  }
}

// 更新主题
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, color, approved } = updateTopicSchema.parse(body);

    // 如果更新名称，检查是否与其他主题冲突
    if (name) {
      const existingTopic = await db.topic.findFirst({
        where: { 
          name,
          NOT: { id }
        }
      });

      if (existingTopic) {
        return Response.json({ success: false, error: '主题名称已存在' }, { status: 400 });
      }
    }

    const topic = await db.topic.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(approved !== undefined && { approved })
      }
    });

    return Response.json({ success: true, topic });
  } catch (error) {
    console.error('更新主题失败:', error);
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: '输入数据格式错误' }, { status: 400 });
    }
    return Response.json({ success: false, error: '更新主题失败' }, { status: 500 });
  }
}

// 删除主题
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ success: false, error: '缺少主题ID' }, { status: 400 });
    }

    // 检查是否有播客使用此主题
    const podcastCount = await db.podcast.count({
      where: { topicId: id }
    });

    if (podcastCount > 0) {
      return Response.json({ 
        success: false, 
        error: `无法删除主题，还有 ${podcastCount} 个播客使用此主题` 
      }, { status: 400 });
    }

    await db.topic.delete({
      where: { id }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('删除主题失败:', error);
    return Response.json({ success: false, error: '删除主题失败' }, { status: 500 });
  }
}
