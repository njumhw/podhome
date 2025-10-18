import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { requireUser } from '@/server/auth';

// 获取播客列表
export async function GET(req: NextRequest) {
  try {
    // 权限检查 - 如果用户未登录或不是管理员，返回空数据而不是错误
    try {
      const user = await requireUser();
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ 
          success: true, 
          podcasts: [], 
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          stats: { total: 0 }
        });
      }
    } catch (error) {
      // 用户未登录，返回空数据
      return NextResponse.json({ 
        success: true, 
        podcasts: [], 
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        stats: { total: 0 }
      });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { showAuthor: { contains: search, mode: 'insensitive' } },
        { sourceUrl: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 简化查询，只查询AudioCache表
    const audioCacheWhere = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
          { audioUrl: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const audioCacheData = await db.audioCache.findMany({
      where: audioCacheWhere,
      select: {
        id: true,
        title: true,
        author: true,
        audioUrl: true,
        duration: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        topic: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    // 转换数据格式
    const podcasts = audioCacheData.map(cache => ({
      id: cache.id,
      title: cache.title || '未知标题',
      showAuthor: cache.author || '未知作者',
      sourceUrl: cache.audioUrl,
      status: 'COMPLETED' as const, // AudioCache中的数据都是已完成的
      publishedAt: cache.publishedAt,
      duration: cache.duration,
      createdAt: cache.createdAt,
      processingStartedAt: cache.createdAt,
      processingCompletedAt: cache.updatedAt,
      topic: cache.topic
    }));

    // 获取总数
    const total = await db.audioCache.count({
      where: audioCacheWhere
    });

    // 简化统计信息获取
    const audioCacheCount = await db.audioCache.count();
    const statusCounts = {
      COMPLETED: audioCacheCount,
      total: audioCacheCount
    };

    return NextResponse.json({
      success: true,
      podcasts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        total: total,
        ...statusCounts
      }
    });

  } catch (error) {
    console.error('获取播客列表失败:', error);
    return NextResponse.json({ success: false, error: '获取播客列表失败' }, { status: 500 });
  }
}

// 删除播客
export async function DELETE(req: NextRequest) {
  try {
    // 权限检查
    try {
      const user = await requireUser();
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少播客ID' }, { status: 400 });
    }

    // 检查播客是否存在（先查Podcast表，再查AudioCache表）
    let podcast = null;
    let audioCache = null;
    
    try {
      podcast = await db.podcast.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          status: true
        }
      });
    } catch (error) {
      console.error('查询Podcast表失败:', error);
    }

    if (!podcast) {
      try {
        audioCache = await db.audioCache.findUnique({
          where: { id },
          select: {
            id: true,
            title: true
          }
        });
      } catch (error) {
        console.error('查询AudioCache表失败:', error);
      }
    }

    if (!podcast && !audioCache) {
      return NextResponse.json({ success: false, error: '播客不存在' }, { status: 404 });
    }

    const targetTitle = podcast?.title || audioCache?.title || '未知播客';

    // 使用事务删除播客及其关联数据，增加超时时间和重试机制
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await db.$transaction(async (tx) => {
          if (podcast) {
            // 删除Podcast表的关联数据
            await tx.accessLog.deleteMany({
              where: { podcastId: id }
            });

            await tx.taskLog.deleteMany({
              where: { podcastId: id }
            });

            await tx.transcriptChunk.deleteMany({
              where: { podcastId: id }
            });

            await tx.podcast.delete({
              where: { id }
            });
          } else if (audioCache) {
            // 删除AudioCache表的关联数据
            await tx.accessLog.deleteMany({
              where: { audioCacheId: id }
            });

            await tx.audioCache.delete({
              where: { id }
            });
          }
        }, {
          timeout: 30000, // 增加事务超时时间到30秒
          maxWait: 10000, // 最大等待时间10秒
        });
        
        // 如果成功，跳出重试循环
        break;
        
      } catch (error: any) {
        retryCount++;
        console.error(`删除播客失败，重试 ${retryCount}/${maxRetries}:`, error);
        
        if (retryCount >= maxRetries) {
          throw error; // 重试次数用完，抛出错误
        }
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
    }

    return NextResponse.json({
      success: true,
      message: `播客 "${targetTitle}" 已删除`
    });

  } catch (error) {
    console.error('删除播客失败:', error);
    return NextResponse.json({ success: false, error: '删除播客失败' }, { status: 500 });
  }
}
