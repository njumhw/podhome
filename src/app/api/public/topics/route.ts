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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    console.error('获取主题列表失败:', errorMessage);
    if (errorStack) {
      console.error('错误堆栈:', errorStack.substring(0, 500));
    }
    
    // 检查是否是数据库连接错误
    const isDatabaseError = 
      errorMessage.includes('数据库') || 
      errorMessage.includes('database') ||
      errorMessage.includes('prisma') ||
      errorMessage.includes('P1001') || // Prisma 连接错误
      errorMessage.includes('P1002') || // Prisma 连接超时
      errorMessage.includes('P1017'); // Prisma 服务器关闭连接
    
    let detailedError = '获取主题列表失败';
    if (isDatabaseError) {
      detailedError = '数据库连接失败，请检查数据库配置或重启服务器';
    } else if (errorMessage.includes('Cannot find module') || errorMessage.includes('Module not found')) {
      detailedError = '模块加载失败，请重启开发服务器';
    }
    
    return Response.json({ 
      success: false, 
      error: detailedError,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}
