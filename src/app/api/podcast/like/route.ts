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

    // 使用事务确保数据一致性：同时更新PodcastLike表和Podcast.likeCount字段
    const result = await db.$transaction(async (tx) => {
      if (existingLike) {
        // 如果已经点赞，则取消点赞
        await tx.podcastLike.delete({
          where: { id: existingLike.id }
        });

        // 原子性更新likeCount（减1，但不低于0）
        const updatedPodcast = await tx.podcast.update({
          where: { id: podcastId },
          data: {
            likeCount: {
              decrement: 1
            }
          },
          select: {
            likeCount: true
          }
        });

        return {
          liked: false,
          likeCount: Math.max(0, updatedPodcast.likeCount), // 确保不为负数
          message: '已取消点赞'
        };
      } else {
        // 如果没有点赞，则添加点赞
        await tx.podcastLike.create({
          data: {
            podcastId,
            userId: user.id,
          }
        });

        // 原子性更新likeCount（加1）
        const updatedPodcast = await tx.podcast.update({
          where: { id: podcastId },
          data: {
            likeCount: {
              increment: 1
            }
          },
          select: {
            likeCount: true
          }
        });

        return {
          liked: true,
          likeCount: updatedPodcast.likeCount,
          message: '点赞成功'
        };
      }
    });

    return NextResponse.json({ 
      success: true, 
      ...result
    });

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

    // 优先使用likeCount字段（已优化），如果字段不存在则回退到count查询
    let likeCount = 0;
    try {
      const podcast = await db.podcast.findUnique({
        where: { id: podcastId },
        select: { likeCount: true }
      });
      likeCount = podcast?.likeCount ?? 0;
    } catch (error) {
      // 如果likeCount字段不存在（兼容旧数据），回退到count查询
      console.warn('[点赞API] likeCount字段不存在，使用count查询作为回退:', error);
      likeCount = await db.podcastLike.count({
        where: { podcastId }
      });
    }

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
