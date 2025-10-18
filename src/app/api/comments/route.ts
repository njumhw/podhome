import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/utils/http";

const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  podcastId: z.string().optional(),
  audioCacheId: z.string().optional(),
});

const likeCommentSchema = z.object({
  commentId: z.string(),
  action: z.enum(['like', 'unlike']),
});

// GET - 获取评论列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const podcastId = searchParams.get('podcastId');
    const audioCacheId = searchParams.get('audioCacheId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    if (!podcastId && !audioCacheId) {
      return jsonError("Either podcastId or audioCacheId is required", 400);
    }

    const where = podcastId 
      ? { podcastId } 
      : { audioCacheId };

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
            }
          },
          commentLikes: {
            select: {
              userId: true,
            }
          }
        },
        orderBy: [
          { likes: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: offset,
        take: limit,
      }),
      db.comment.count({ where })
    ]);

    // 获取当前用户信息（如果已登录）
    let currentUserId: string | null = null;
    try {
      const user = await requireUser().catch(() => null);
      currentUserId = user?.id || null;
    } catch {
      // 用户未登录，继续处理
    }

    const formattedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      author: comment.user.username,
      likes: comment.likes,
      createdAt: comment.createdAt.toISOString(),
      liked: currentUserId ? comment.commentLikes.some(like => like.userId === currentUserId) : false,
    }));

    return Response.json({
      success: true,
      comments: formattedComments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });

  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return jsonError("Failed to fetch comments", 500);
  }
}

// POST - 创建评论
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { content, podcastId, audioCacheId } = createCommentSchema.parse(body);

    if (!podcastId && !audioCacheId) {
      return jsonError("Either podcastId or audioCacheId is required", 400);
    }

    // 验证播客或音频缓存是否存在
    if (podcastId) {
      const podcast = await db.podcast.findUnique({
        where: { id: podcastId }
      });
      if (!podcast) {
        return jsonError("Podcast not found", 404);
      }
    }

    if (audioCacheId) {
      const audioCache = await db.audioCache.findUnique({
        where: { id: audioCacheId }
      });
      if (!audioCache) {
        return jsonError("Audio cache not found", 404);
      }
    }

    const comment = await db.comment.create({
      data: {
        content,
        podcastId,
        audioCacheId,
        userId: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    });

    return Response.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        author: comment.user.username,
        likes: comment.likes,
        createdAt: comment.createdAt.toISOString(),
        liked: false,
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid request data", 400);
    }
    console.error('Failed to create comment:', error);
    return jsonError("Failed to create comment", 500);
  }
}

// PUT - 点赞/取消点赞评论
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { commentId, action } = likeCommentSchema.parse(body);

    // 检查评论是否存在
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: {
        commentLikes: {
          where: { userId: user.id }
        }
      }
    });

    if (!comment) {
      return jsonError("Comment not found", 404);
    }

    const existingLike = comment.commentLikes[0];
    const isLiked = !!existingLike;

    if (action === 'like' && !isLiked) {
      // 添加点赞
      await db.$transaction([
        db.commentLike.create({
          data: {
            commentId,
            userId: user.id,
          }
        }),
        db.comment.update({
          where: { id: commentId },
          data: { likes: { increment: 1 } }
        })
      ]);
    } else if (action === 'unlike' && isLiked) {
      // 取消点赞
      await db.$transaction([
        db.commentLike.delete({
          where: {
            commentId_userId: {
              commentId,
              userId: user.id,
            }
          }
        }),
        db.comment.update({
          where: { id: commentId },
          data: { likes: { decrement: 1 } }
        })
      ]);
    }

    // 获取更新后的点赞数
    const updatedComment = await db.comment.findUnique({
      where: { id: commentId },
      select: { likes: true }
    });

    return Response.json({
      success: true,
      likes: updatedComment?.likes || 0,
      liked: action === 'like'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid request data", 400);
    }
    console.error('Failed to like/unlike comment:', error);
    return jsonError("Failed to like/unlike comment", 500);
  }
}
