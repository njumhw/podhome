// 实时进度查询API
import { NextRequest, NextResponse } from "next/server";
import { getRealTimeProgress, formatDuration, formatRemainingTime } from "@/utils/real-time-progress";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const podcastId = searchParams.get('podcastId');
    
    if (!podcastId) {
      return NextResponse.json({ error: 'Missing podcastId parameter' }, { status: 400 });
    }
    
    const progress = await getRealTimeProgress(podcastId);
    
    if (!progress) {
      return NextResponse.json({ 
        error: 'No real-time progress data found. This podcast may not be using the new pipeline system.' 
      }, { status: 404 });
    }
    
    // 格式化响应数据
    const response = {
      success: true,
      progress: {
        podcastId: progress.podcastId,
        overallStatus: progress.overallStatus,
        overallProgress: progress.overallProgress,
        currentStep: progress.currentStep,
        startTime: progress.startTime,
        endTime: progress.endTime,
        totalDuration: progress.totalDuration ? formatDuration(progress.totalDuration) : undefined,
        estimatedRemainingTime: progress.estimatedRemainingTime ? 
          formatRemainingTime(progress.estimatedRemainingTime) : undefined,
        steps: progress.steps.map(step => ({
          id: step.id,
          name: step.name,
          description: step.description,
          status: step.status,
          progress: step.progress,
          actualDuration: step.actualDuration ? formatDuration(step.actualDuration) : undefined,
          estimatedDuration: step.estimatedDuration ? formatDuration(step.estimatedDuration) : undefined,
          error: step.error
        }))
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('Real-time progress query failed:', error);
    return NextResponse.json({ error: `查询失败: ${error.message}` }, { status: 500 });
  }
}
