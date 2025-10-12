import { NextRequest } from "next/server";
import { jsonError } from "@/utils/http";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { processingId } = body;
    
    if (!processingId) {
      return jsonError("Missing processing ID", 400);
    }
    
    // 这里可以实现真正的取消逻辑
    // 比如：
    // 1. 停止正在进行的处理任务
    // 2. 清理临时文件
    // 3. 更新数据库状态
    
    // 目前只是返回成功，实际的取消逻辑需要根据具体的处理流程来实现
    console.log(`取消处理任务: ${processingId}`);
    
    return Response.json({
      success: true,
      message: "处理任务已取消"
    });
    
  } catch (error: any) {
    console.error("取消处理失败:", error);
    return jsonError(error?.message || "取消处理失败", 500);
  }
}
