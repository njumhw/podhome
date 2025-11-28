import { NextRequest } from "next/server";
import { db } from "@/server/db";

// 获取已审核的主题列表
export async function GET(req: NextRequest) {
  try {
    console.log('[api/public/topics] 开始获取主题列表...');
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

    console.log(`[api/public/topics] 成功获取 ${topics.length} 个主题`);
    return Response.json({ success: true, topics });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code;
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    console.error('[api/public/topics] 获取主题列表失败:', {
      message: errorMessage,
      code: errorCode,
      name: errorName,
      stack: errorStack?.substring(0, 500)
    });
    
    // 检查是否是数据库连接错误
    const isDatabaseError = 
      errorMessage.includes('数据库') || 
      errorMessage.includes('database') ||
      errorMessage.includes('prisma') ||
      errorMessage.includes('Can\'t reach database') ||
      errorMessage.includes('connection pool') ||
      errorMessage.includes('P1001') || // Prisma 连接错误
      errorMessage.includes('P1002') || // Prisma 连接超时
      errorMessage.includes('P1017') || // Prisma 服务器关闭连接
      errorCode === 'P1001' ||
      errorCode === 'P1002' ||
      errorCode === 'P1017';
    
    // 如果是数据库连接错误，返回空数组而不是500错误，避免前端崩溃
    if (isDatabaseError) {
      console.error('[api/public/topics] 数据库连接问题，返回空数组');
      return Response.json({ 
        success: true, 
        topics: [] // 返回空数组而不是错误
      });
    }
    
    // 其他错误也返回空数组，避免前端崩溃
    console.error('[api/public/topics] 返回空数组以避免前端崩溃');
    return Response.json({ 
      success: true, 
      topics: [] 
    });
  }
}
