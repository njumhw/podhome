// 任务状态查询API
import { NextRequest } from "next/server";
import { taskQueue } from "@/server/task-queue";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const url = searchParams.get('url');
    
    if (!taskId && !url) {
      return Response.json({ error: 'Missing taskId or url parameter' }, { status: 400 });
    }
    
    let task;
    if (taskId) {
      task = await taskQueue.getTaskStatus(taskId);
    } else if (url) {
      // 通过URL查找任务
      task = await taskQueue.getTaskByUrl(url);
    }
    
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
      metrics: task.metrics,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt
    });
    
  } catch (error: unknown) {
    console.error('Task status query failed:', error);
    return Response.json({ error: `查询失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}

function getProgressFromStatus(status: string): number {
  switch (status) {
    case 'PENDING': return 0;
    case 'RUNNING': return 50;
    case 'READY': return 100;
    case 'FAILED': return 0;
    default: return 0;
  }
}
