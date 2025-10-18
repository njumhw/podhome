import { NextRequest, NextResponse } from 'next/server';
import { checkPodcastDataConsistency, autoFixDataConsistency, batchCheckDataConsistency } from '@/utils/data-consistency';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (action === 'batch') {
      // 批量检查所有播客
      const results = await batchCheckDataConsistency();
      const totalCount = results.length;
      const issueCount = results.filter(r => r.issues.length > 0).length;
      
      return NextResponse.json({
        success: true,
        totalCount,
        issueCount,
        results: results.filter(r => r.issues.length > 0) // 只返回有问题的
      });
    }

    if (id) {
      // 检查特定播客
      const check = await checkPodcastDataConsistency(id);
      return NextResponse.json({
        success: true,
        check
      });
    }

    return NextResponse.json(
      { error: '需要提供id参数或action=batch' },
      { status: 400 }
    );

  } catch (error) {
    console.error('数据一致性检查失败:', error);
    return NextResponse.json(
      { error: '数据一致性检查失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: '需要提供id参数' },
        { status: 400 }
      );
    }

    const success = await autoFixDataConsistency(id);
    
    return NextResponse.json({
      success,
      message: success ? '数据一致性修复成功' : '数据一致性修复失败'
    });

  } catch (error) {
    console.error('数据一致性修复失败:', error);
    return NextResponse.json(
      { error: '数据一致性修复失败' },
      { status: 500 }
    );
  }
}
