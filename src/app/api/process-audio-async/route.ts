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
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    
    if (!parsed.success) {
      return jsonError("Invalid URL", 400);
    }
    
    const { url } = parsed.data;
    
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
    }
    
    // 确定用户额度
    let quota = 0;
    if (user) {
      if (user.role === 'ADMIN') {
        quota = Infinity;
      } else if (user.role === 'USER') {
        quota = 5;
      } else {
        quota = 0;
      }
    } else {
      quota = 0;
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
    const taskId = await taskQueue.addTask({
      type: 'PODCAST_PROCESSING',
      data: {
        url,
        userId: user?.id
      }
    });
    
    return Response.json({
      success: true,
      taskId,
      message: "播客处理任务已提交，将在后台处理",
      estimatedTime: "10-15分钟"
    });
    
  } catch (error: unknown) {
    console.error('Async processing failed:', error);
    return jsonError(`处理失败: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}
