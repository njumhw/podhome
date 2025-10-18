import { NextRequest, NextResponse } from 'next/server';
import { taskQueue } from '@/server/task-queue';

export async function GET(request: NextRequest) {
  try {
    const status = await taskQueue.getQueueStatus();
    
    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('获取队列状态失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取队列状态失败' 
      },
      { status: 500 }
    );
  }
}
