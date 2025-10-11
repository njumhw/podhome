import { NextRequest } from "next/server";
import { db } from "@/server/db";

// 获取已审核的主题列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeCount = searchParams.get('includeCount') === 'true';

    const topics = await db.topic.findMany({
      where: { approved: true },
      orderBy: { name: 'asc' },
      include: includeCount ? {
        _count: {
          select: { podcasts: true }
        }
      } : undefined
    });

    return Response.json({ success: true, topics });
  } catch (error) {
    console.error('获取主题列表失败:', error);
    return Response.json({ success: false, error: '获取主题列表失败' }, { status: 500 });
  }
}
