// 任务状态查询API
import { NextRequest } from "next/server";
import { taskQueue } from "@/server/task-queue";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    
    if (!taskId) {
      return Response.json({ error: 'Missing taskId parameter' }, { status: 400 });
    }
    
    const task = await taskQueue.getTaskStatus(taskId);
    
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }
    
    return Response.json({
      success: true,
      id: task.id,
      status: task.status,
      progress: getProgressFromStatus(task.status),
      data: task.data,
      result: task.result,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt
    });
    
  } catch (error: any) {
    console.error('Task status query failed:', error);
    return Response.json({ error: `查询失败: ${error.message}` }, { status: 500 });
  }
}

function getProgressFromStatus(status: string): number {
  switch (status) {
    case 'PENDING': return 0;
    case 'RUNNING': return 50;
    case 'COMPLETED': return 100;
    case 'FAILED': return 0;
    default: return 0;
  }
}
