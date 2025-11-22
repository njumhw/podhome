// 异步播客处理API
import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { taskQueue } from "@/server/task-queue";

const bodySchema = z.object({
  url: z.string().url(),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 添加请求体解析超时
    let body: any;
    try {
      body = await Promise.race([
        req.json(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('请求体解析超时')), 10000)
        )
      ]) as any;
    } catch (parseError) {
      console.error('请求体解析失败:', parseError);
      return jsonError("请求格式错误或超时", 400);
    }
    
    const parsed = bodySchema.safeParse(body);
    
    if (!parsed.success) {
      console.error('URL验证失败:', parsed.error);
      return jsonError("Invalid URL", 400);
    }
    
    const { url } = parsed.data;
    console.log(`[process-audio-async] 收到处理请求: ${url}, 耗时: ${Date.now() - startTime}ms`);
    
    // 检查用户认证和额度
    let user = null;
    
    try {
      user = await getSessionUser();
    } catch (error) {
      console.error('Auth check failed:', error);
    }
    
    // 检查用户额度
    const today = new Date().toISOString().split('T')[0];
    let dailyUsage = 0;
    
    if (user) {
      try {
        const usage = await db.podcast.count({
          where: {
            createdById: user.id,
            createdAt: {
              gte: new Date(today + 'T00:00:00.000Z'),
              lt: new Date(today + 'T23:59:59.999Z')
            }
          }
        });
        dailyUsage = usage;
      } catch (dbError) {
        const dbErrorMsg = dbError instanceof Error ? dbError.message : String(dbError);
        console.error('[process-audio-async] 数据库查询失败:', dbErrorMsg);
        // 如果是数据库错误，直接抛出，会被 catch 块捕获并返回 503
        throw new Error(`数据库查询失败: ${dbErrorMsg}`);
      }
    }
    
    // 确定用户额度
    let quota = 0;
    if (user) {
      if (user.role === 'ADMIN') {
        quota = Infinity;
      } else if (user.role === 'USER') {
        quota = 2;
      } else {
        quota = 0;
      }
    } else {
      // 允许无认证用户处理，用于测试
      quota = 1;
    }
    
    // 检查是否超出额度
    if (dailyUsage >= quota) {
      if (!user) {
        return jsonError("请先登录后再处理播客", 401);
      } else if (user.role === 'USER') {
        return jsonError("今日处理额度已用完，请明天再试", 429);
      } else {
        return jsonError("无权限处理播客", 403);
      }
    }
    
    console.log(`开始异步处理播客链接: ${url}`);
    
    // 添加任务到队列
    let taskId: string;
    try {
      taskId = await taskQueue.addTask({
        type: 'PODCAST_PROCESSING',
        data: {
          url,
          userId: user?.id
        }
      });
      console.log(`[process-audio-async] ✅ 任务已添加到队列: ${taskId}`);
    } catch (taskError) {
      const taskErrorMsg = taskError instanceof Error ? taskError.message : String(taskError);
      console.error('[process-audio-async] 添加任务到队列失败:', taskErrorMsg);
      // 如果是数据库错误，会被 catch 块捕获并返回 503
      throw new Error(`添加任务失败: ${taskErrorMsg}`);
    }
    
    return Response.json({
      success: true,
      taskId,
      message: "播客处理任务已提交，将在后台处理",
      estimatedTime: "10-15分钟"
    });
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    console.error('═══════════════════════════════════════════════════════════');
    console.error('[process-audio-async] ❌ 处理失败');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('耗时:', `${duration}ms`);
    console.error('错误类型:', errorName);
    console.error('错误信息:', errorMessage);
    if (errorStack) {
      console.error('错误堆栈:', errorStack.substring(0, 1000));
    }
    console.error('═══════════════════════════════════════════════════════════');
    
    // 根据错误类型返回更详细的错误信息
    let statusCode = 500;
    let errorMsg = errorMessage;
    
    // 检查是否是数据库相关错误
    const isDatabaseError = 
      errorMessage.includes('数据库') || 
      errorMessage.includes('database') || 
      errorMessage.includes('prisma') ||
      errorMessage.includes('P1001') || // Prisma 连接错误
      errorMessage.includes('P1002') || // Prisma 连接超时
      errorMessage.includes('P1003') || // Prisma 数据库不存在
      errorMessage.includes('P1017') || // Prisma 服务器关闭连接
      errorName === 'PrismaClientKnownRequestError' ||
      errorName === 'PrismaClientInitializationError' ||
      errorName === 'PrismaClientRustPanicError';
    
    if (isDatabaseError) {
      statusCode = 503;
      errorMsg = '数据库连接问题，请稍后重试';
      console.error('[process-audio-async] 检测到数据库错误，返回 503');
    } else if (errorMessage.includes('超时') || errorMessage.includes('timeout')) {
      statusCode = 504;
      errorMsg = '请求处理超时，请稍后重试';
    } else if (errorMessage.includes('网络') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
      statusCode = 502;
      errorMsg = '网络请求失败，请检查网络连接';
    }
    
    return jsonError(errorMsg, statusCode);
  }
}
