import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth';
import { db } from '@/server/db';

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
    const used = await db.podcast.count({
      where: {
        createdById: user.id,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    });

    // 确定用户额度
    let limit = 0;
    if (user.role === 'ADMIN') {
      limit = Infinity; // 管理员无限制
    } else if (user.role === 'USER') {
      limit = 5; // 普通用户每天5个
    } else {
      limit = 0; // 其他角色无额度
    }

    return NextResponse.json({
      success: true,
      used,
      limit: limit === Infinity ? -1 : limit // -1 表示无限制
    });

  } catch (error) {
    console.error('Daily usage API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
