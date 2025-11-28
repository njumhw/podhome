import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth';
import { db } from '@/server/db';
import { getUserDailyLimit } from '@/server/user-limits';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 获取今天的日期范围
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // 查询用户今日的使用量（通过Podcast表）
    // 注意：计算所有今天创建的播客，包括处理中的，因为用户已经占用了额度
    const used = await db.podcast.count({
      where: {
        createdById: user.id,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    });

    // 使用统一的权限检查函数获取用户额度
    const limit = getUserDailyLimit(user.role);

    // 添加调试日志（仅在开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[daily-usage] User ${user.id} (${user.role}): used=${used}, limit=${limit}`);
    }

    return NextResponse.json({
      success: true,
      used,
      limit: limit === -1 ? -1 : limit // -1 表示无限制（VIP和管理员）
    });

  } catch (error) {
    console.error('Daily usage API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
