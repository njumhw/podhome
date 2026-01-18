// 异步播客处理API
import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { taskQueue } from "@/server/task-queue";
import { checkUserUploadLimit } from "@/server/user-limits";
import { normalizePodcastUrl } from "@/utils/url-normalizer";

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
    
    // 标准化URL（移除查询参数等，确保相同内容的URL被视为同一个）
    const normalizedUrl = normalizePodcastUrl(url);
    if (normalizedUrl !== url) {
      console.log(`[process-audio-async] URL已标准化: ${url} -> ${normalizedUrl}`);
    }
    
    // 检查用户认证
    let user = null;
    
    try {
      user = await getSessionUser();
    } catch (error) {
      console.error('Auth check failed:', error);
    }
    
    // 必须登录才能处理播客
    if (!user) {
      return jsonError("请先登录后再处理播客", 401);
    }
    
    // 使用统一的权限检查函数（支持所有角色：PODCASTER, PODCASTER_VIP, ADMIN等）
    const limitCheck = await checkUserUploadLimit(user.id, user.role);
    
    if (!limitCheck.allowed) {
      return jsonError(limitCheck.reason || "无权限处理播客", 403);
    }
    
    // 如果有限制且已超过，返回429
    if (limitCheck.limit > 0 && limitCheck.currentCount >= limitCheck.limit) {
      return jsonError(limitCheck.reason || "今日处理额度已用完，请明天再试", 429);
    }
    
    console.log(`开始异步处理播客链接: ${normalizedUrl}`);
    
    // ========== 重复检查：在添加任务前检查是否已存在相同 URL 的播客 ==========
    const existingPodcast = await db.podcast.findFirst({
      where: {
        sourceUrl: normalizedUrl,
        status: 'READY', // 只检查已完成的播客
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    
    if (existingPodcast) {
      console.log(`[process-audio-async] ⚠️ 播客已存在，跳过重复处理: url=${normalizedUrl.substring(0, 100)}..., existingId=${existingPodcast.id}`);
      return Response.json({
        success: true,
        taskId: null,
        podcastId: existingPodcast.id,
        message: "播客已存在，无需重复处理",
        fromCache: true,
      });
    }
    
    // 检查是否正在处理中（避免并发处理）
    const processingPodcast = await db.podcast.findFirst({
      where: {
        sourceUrl: normalizedUrl,
        status: 'PROCESSING',
      },
      select: {
        id: true,
        title: true,
        status: true,
        processingStartedAt: true,
      },
      orderBy: {
        processingStartedAt: 'desc',
      },
    });
    
    if (processingPodcast) {
      const processingTime = processingPodcast.processingStartedAt 
        ? Date.now() - new Date(processingPodcast.processingStartedAt).getTime()
        : 0;
      const processingMinutes = Math.floor(processingTime / 60000);
      
      // 如果处理时间超过30分钟，可能是卡住了，允许重新处理
      if (processingMinutes < 30) {
        console.log(`[process-audio-async] ⚠️ 播客正在处理中，跳过重复处理: url=${normalizedUrl.substring(0, 100)}..., processingId=${processingPodcast.id}, 已处理${processingMinutes}分钟`);
        return Response.json({
          success: true,
          taskId: null,
          podcastId: processingPodcast.id,
          message: `播客正在处理中（已处理${processingMinutes}分钟），请稍候`,
          fromCache: true,
        });
      } else {
        console.log(`[process-audio-async] ⚠️ 播客处理时间过长（${processingMinutes}分钟），可能是卡住了，允许重新处理`);
      }
    }
    
    // 检查是否有相同URL的失败播客（状态为FAILED），如果失败时间超过5分钟，允许重新处理
    const failedPodcast = await db.podcast.findFirst({
      where: {
        sourceUrl: normalizedUrl,
        status: 'FAILED',
      },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    
    if (failedPodcast) {
      const failedTime = Date.now() - new Date(failedPodcast.updatedAt).getTime();
      const failedMinutes = Math.floor(failedTime / 60000);
      
      // 如果失败时间超过5分钟，允许重新处理
      if (failedMinutes < 5) {
        console.log(`[process-audio-async] ⚠️ 播客最近失败过（${failedMinutes}分钟前），跳过重复处理: url=${normalizedUrl.substring(0, 100)}...`);
        // 不返回错误，而是继续处理，但记录警告
      } else {
        console.log(`[process-audio-async] ⚠️ 播客失败时间较长（${failedMinutes}分钟前），允许重新处理`);
      }
    }
    // ========================================================================
    
    // 添加任务到队列（使用标准化后的URL）
    // 注意：taskQueue.addTask 内部已经检查了是否有相同URL的正在运行的任务
    let taskId: string;
    try {
      taskId = await taskQueue.addTask({
        type: 'PODCAST_PROCESSING',
        data: {
          url: normalizedUrl, // 使用标准化后的URL
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
