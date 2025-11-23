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

    // 查询两个表并合并数据
    const [audioCacheData, podcastData] = await Promise.all([
      db.audioCache.findMany({
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
        }
      }),
      db.podcast.findMany({
        select: {
          id: true,
          title: true,
          showAuthor: true,
          sourceUrl: true,
          duration: true,
          createdAt: true,
          processingCompletedAt: true,
          publishedAt: true,
          status: true,
          topic: {
            select: {
              id: true,
              name: true,
              color: true
            }
          },
          createdBy: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    // 合并数据，优先使用Podcast表的数据
    const mergedData = new Map();
    
    // 先添加Podcast数据（主要数据源）
    podcastData.forEach(podcast => {
      mergedData.set(podcast.id, {
        id: podcast.id,
        title: podcast.title,
        showAuthor: podcast.showAuthor,
        sourceUrl: podcast.sourceUrl,
        status: podcast.status,
        publishedAt: podcast.publishedAt,
        duration: podcast.duration,
        createdAt: podcast.createdAt,
        processingStartedAt: podcast.createdAt,
        processingCompletedAt: podcast.processingCompletedAt,
        topic: podcast.topic, // Podcast表的topic是主要数据源
        createdBy: podcast.createdBy,
        source: 'podcast'
      });
    });
    
    // 用AudioCache数据补充（只补充Podcast表中没有的字段）
    audioCacheData.forEach(cache => {
      if (mergedData.has(cache.id)) {
        // 如果Podcast表中已有，只补充缺失的字段，但topic优先使用Podcast的
        const existing = mergedData.get(cache.id);
        mergedData.set(cache.id, {
          ...existing,
          // 如果Podcast表中没有某些字段，使用AudioCache的
          title: existing.title || cache.title,
          showAuthor: existing.showAuthor || cache.author,
          sourceUrl: existing.sourceUrl || cache.audioUrl,
          publishedAt: existing.publishedAt || cache.publishedAt,
          duration: existing.duration || cache.duration,
          // topic始终优先使用Podcast表的（如果Podcast有topic，就用Podcast的；否则用AudioCache的）
          topic: existing.topic || cache.topic,
          source: 'both'
        });
      } else {
        // 如果Podcast表中没有，添加AudioCache数据
        mergedData.set(cache.id, {
          id: cache.id,
          title: cache.title,
          showAuthor: cache.author,
          sourceUrl: cache.audioUrl,
          status: 'READY' as const,
          publishedAt: cache.publishedAt,
          duration: cache.duration,
          createdAt: cache.createdAt,
          processingStartedAt: cache.createdAt,
          processingCompletedAt: cache.updatedAt,
          topic: cache.topic,
          source: 'audioCache'
        });
      }
    });

    // 转换为数组并应用搜索过滤
    let podcasts = Array.from(mergedData.values());
    
    if (search) {
      podcasts = podcasts.filter(p => 
        (p.title && p.title.toLowerCase().includes(search.toLowerCase())) ||
        (p.showAuthor && p.showAuthor.toLowerCase().includes(search.toLowerCase())) ||
        (p.sourceUrl && p.sourceUrl.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    if (status && status !== 'all') {
      podcasts = podcasts.filter(p => p.status === status);
    }

    // 应用分页
    const total = podcasts.length;
    podcasts = podcasts.slice(skip, skip + limit);

    // 确保标题和作者不为空
    podcasts = podcasts.map(p => ({
      ...p,
      title: p.title || '未知标题',
      showAuthor: p.showAuthor || '未知作者'
    }));

    // 统计信息
    const statusCounts = {
      READY: podcasts.filter(p => p.status === 'READY').length,
      PROCESSING: podcasts.filter(p => p.status === 'PROCESSING').length,
      FAILED: podcasts.filter(p => p.status === 'FAILED').length,
      total: total
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

    // 检查播客是否存在（同时查询两个表）
    let podcast = null;
    let audioCache = null;
    
    try {
      podcast = await db.podcast.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          status: true,
          sourceUrl: true
        }
      });
    } catch (error) {
      console.error('查询Podcast表失败:', error);
    }

    try {
      audioCache = await db.audioCache.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          audioUrl: true,
          originalUrl: true
        }
      });
    } catch (error) {
      console.error('查询AudioCache表失败:', error);
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
          // 删除Podcast表的数据（如果存在）
          if (podcast) {
            // 删除所有关联数据
            await tx.accessLog.deleteMany({
              where: { podcastId: id }
            });

            await tx.taskLog.deleteMany({
              where: { podcastId: id }
            });

            await tx.transcriptChunk.deleteMany({
              where: { podcastId: id }
            });
            
            // 删除点赞记录
            await tx.podcastLike.deleteMany({
              where: { podcastId: id }
            });
            
            // 删除评论
            await tx.comment.deleteMany({
              where: { podcastId: id }
            });

            await tx.podcast.delete({
              where: { id }
            });
          }

          // 删除AudioCache表的数据（如果存在）
          if (audioCache) {
            await tx.accessLog.deleteMany({
              where: { audioCacheId: id }
            });

            // 使用deleteMany避免记录不存在时的错误
            await tx.audioCache.deleteMany({
              where: { id }
            });
          }
          
          // 如果通过podcast的audioUrl查找audioCache，也尝试删除
          if (podcast?.sourceUrl) {
            // 查找匹配的audioCache（通过originalUrl或audioUrl）
            const matchingCaches = await tx.audioCache.findMany({
              where: {
                OR: [
                  { originalUrl: podcast.sourceUrl },
                  { audioUrl: podcast.sourceUrl }
                ]
              },
              select: { id: true }
            });
            
            // 删除找到的audioCache
            if (matchingCaches.length > 0) {
              await tx.accessLog.deleteMany({
                where: { 
                  audioCacheId: { in: matchingCaches.map(c => c.id) }
                }
              });
              
              await tx.audioCache.deleteMany({
                where: {
                  id: { in: matchingCaches.map(c => c.id) }
                }
              });
            }
          }

          // 通过URL匹配删除相关记录（确保彻底清理）
          const urlsToMatch = [];
          if (podcast?.sourceUrl) urlsToMatch.push(podcast.sourceUrl);
          if (audioCache?.audioUrl) urlsToMatch.push(audioCache.audioUrl);
          if (audioCache?.originalUrl) urlsToMatch.push(audioCache.originalUrl);

          if (urlsToMatch.length > 0) {
            // 删除通过URL匹配的Podcast记录
            await tx.podcast.deleteMany({
              where: { 
                OR: urlsToMatch.map(url => ({ sourceUrl: url }))
              }
            });

            // 删除通过URL匹配的AudioCache记录
            await tx.audioCache.deleteMany({
              where: { 
                OR: [
                  ...urlsToMatch.map(url => ({ audioUrl: url })),
                  ...urlsToMatch.map(url => ({ originalUrl: url }))
                ]
              }
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
