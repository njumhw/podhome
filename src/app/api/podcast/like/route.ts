import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { getSessionUser } from '@/server/auth';

export async function POST(req: NextRequest) {
  try {
    const { podcastId } = await req.json();
    
    if (!podcastId) {
      return NextResponse.json({ error: '播客ID不能为空' }, { status: 400 });
    }

    // 获取用户信息（可能为null，支持游客）
    let user = null;
    try {
      user = await getSessionUser();
    } catch (error) {
      // 忽略认证错误，允许游客点赞
    }

    // 获取客户端IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';

    // 检查是否已经点赞过
    const whereConditions = [];
    if (user) {
      whereConditions.push({ userId: user.id });
    }
    whereConditions.push({ userIp: ip });
    
    const existingLike = await db.podcastLike.findFirst({
      where: {
        podcastId,
        OR: whereConditions
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
          userId: user?.id || null,
          userIp: user ? null : ip
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

    // 获取用户信息（可能为null，支持游客）
    let user = null;
    try {
      user = await getSessionUser();
    } catch (error) {
      // 忽略认证错误，允许游客查看
    }

    // 获取客户端IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';

    // 获取点赞总数
    const likeCount = await db.podcastLike.count({
      where: { podcastId }
    });

    // 检查当前用户是否已点赞
    const whereConditions = [];
    if (user) {
      whereConditions.push({ userId: user.id });
    }
    whereConditions.push({ userIp: ip });
    
    const userLiked = await db.podcastLike.findFirst({
      where: {
        podcastId,
        OR: whereConditions
      }
    });

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
