import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { getSessionUser } from '@/server/auth';

export async function POST(req: NextRequest) {
  try {
    const { podcastId } = await req.json();
    
    if (!podcastId) {
      return NextResponse.json({ error: '播客ID不能为空' }, { status: 400 });
    }

    // 获取用户信息（必须登录，Visitor 不能点赞）
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: '请登录后点赞' }, { status: 401 });
    }

    // 检查是否已经点赞过（仅检查用户ID，不再支持游客IP点赞）
    const existingLike = await db.podcastLike.findFirst({
      where: {
        podcastId,
        userId: user.id,
      }
    });

    if (existingLike) {
      // 如果已经点赞，则取消点赞
      await db.podcastLike.delete({
        where: { id: existingLike.id }
      });

      // 获取更新后的点赞数
      const likeCount = await db.podcastLike.count({
        where: { podcastId }
      });

      return NextResponse.json({ 
        success: true, 
        liked: false, 
        likeCount,
        message: '已取消点赞' 
      });
    } else {
      // 如果没有点赞，则添加点赞
      await db.podcastLike.create({
        data: {
          podcastId,
          userId: user.id,
        }
      });

      // 获取更新后的点赞数
      const likeCount = await db.podcastLike.count({
        where: { podcastId }
      });

      return NextResponse.json({ 
        success: true, 
        liked: true, 
        likeCount,
        message: '点赞成功' 
      });
    }

  } catch (error) {
    console.error('点赞操作失败:', error);
    return NextResponse.json({ 
      error: '点赞操作失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const podcastId = searchParams.get('podcastId');
    
    if (!podcastId) {
      return NextResponse.json({ error: '播客ID不能为空' }, { status: 400 });
    }

    // 获取用户信息（可能为null，用于检查是否已点赞）
    let user = null;
    try {
      user = await getSessionUser();
    } catch (error) {
      // 忽略认证错误，Visitor 可以查看点赞数，但不能点赞
    }

    // 获取点赞总数
    const likeCount = await db.podcastLike.count({
      where: { podcastId }
    });

    // 检查当前用户是否已点赞（仅检查登录用户）
    const userLiked = user ? await db.podcastLike.findFirst({
      where: {
        podcastId,
        userId: user.id,
      }
    }) : null;

    return NextResponse.json({ 
      success: true, 
      likeCount,
      liked: !!userLiked
    });

  } catch (error) {
    console.error('获取点赞信息失败:', error);
    return NextResponse.json({ 
      error: '获取点赞信息失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
