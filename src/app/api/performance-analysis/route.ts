// 性能分析API
import { NextRequest, NextResponse } from 'next/server';
import { 
  analyzeProcessingPerformance, 
  batchAnalyzePerformance, 
  calculateAverageMetrics,
  getOptimizationSuggestions 
} from '@/utils/performance-optimizer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (id) {
      // 分析单个播客的性能
      const metrics = await analyzeProcessingPerformance(id);
      
      if (!metrics) {
        return NextResponse.json({ 
          success: false, 
          error: '播客不存在或缺少必要数据' 
        }, { status: 404 });
      }

      const suggestions = getOptimizationSuggestions(metrics);

      return NextResponse.json({
        success: true,
        metrics,
        suggestions,
        summary: {
          processingSpeed: `${metrics.processingSpeed.toFixed(2)}x`,
          efficiency: `${metrics.efficiency.toFixed(1)}%`,
          audioDuration: `${Math.round(metrics.audioDuration / 60)}分钟`,
          processingTime: `${Math.round(metrics.processingTime / 60)}分钟`
        }
      });

    } else if (action === 'batch') {
      // 批量分析性能
      const limit = parseInt(searchParams.get('limit') || '10');
      const metrics = await batchAnalyzePerformance(limit);
      const average = calculateAverageMetrics(metrics);

      return NextResponse.json({
        success: true,
        totalAnalyzed: metrics.length,
        averageMetrics: average,
        individualMetrics: metrics.map(m => ({
          processingSpeed: m.processingSpeed.toFixed(2),
          efficiency: m.efficiency.toFixed(1),
          audioDuration: Math.round(m.audioDuration / 60),
          processingTime: Math.round(m.processingTime / 60)
        }))
      });

    } else {
      return NextResponse.json({ 
        success: false, 
        error: '缺少必要参数' 
      }, { status: 400 });
    }

  } catch (error: unknown) {
    console.error('性能分析失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: `分析失败: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}