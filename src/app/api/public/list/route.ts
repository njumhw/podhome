import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';
import { cache, cacheKeys } from '@/utils/cache';
import { handleApiError, withRetry } from '@/utils/error-handler';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'latest'; // latest, hot, topics
    const topic = searchParams.get('topic');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 检查缓存（latest 实时返回，不使用缓存）
    const cacheKey = cacheKeys.podcastList(type, topic || undefined, page, limit);
    if (type !== 'latest') {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    let whereClause: any = { status: 'READY' }; // 只展示发布完成的数据
    let topicId: string | null = null;
    
    if (topic) {
      // 先根据主题名称查找主题ID（精确匹配，提高性能）
      const topicRecord = await prisma.topic.findFirst({
        where: { 
          name: { equals: topic, mode: 'insensitive' }, // 改为精确匹配
          approved: true 
        },
        select: { id: true }
      });
      
      if (topicRecord) {
        topicId = topicRecord.id;
        whereClause.topicId = topicId;
      } else {
        // 如果找不到主题，返回空结果
        whereClause.topicId = 'nonexistent';
      }
    }

    let orderBy: any = { updatedAt: 'desc' };
    
    if (type === 'hot') {
      // 热度排序：基于访问次数计算热度分数
      // 暂时使用更新时间作为热度指标，后续会实现真正的访问次数排序
      orderBy = { updatedAt: 'desc' };
    }

    // 统一使用Podcast表查询
    const podcastWhere = {
      ...whereClause
    };

    const [podcastItemsRaw, podcastTotal] = await withRetry(async () => {
      return await Promise.all([
        prisma.podcast.findMany({
          where: podcastWhere,
          select: {
            id: true,
            title: true,
            showAuthor: true,
            publishedAt: true,
            audioUrl: true,
            sourceUrl: true,
            summary: true,
            topic: { select: { name: true } },
            updatedAt: true
          },
          orderBy,
          skip: offset,
          take: limit
        }),
        prisma.podcast.count({ 
          where: podcastWhere
        })
      ]);
    });

    // 去重：同一 sourceUrl 仅保留最新的一条
    const seen = new Map<string, any>();
    for (const item of podcastItemsRaw) {
      const key = item.sourceUrl || item.id;
      const prev = seen.get(key);
      if (!prev || new Date(item.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
        seen.set(key, item);
      }
    }
    const podcastItems = Array.from(seen.values());

    // 格式化数据
    let items = podcastItems.map(item => ({
      id: item.id,
      title: item.title || '未知标题',
      showAuthor: item.showAuthor || '未知作者',
      publishedAt: item.publishedAt,
      audioUrl: item.audioUrl,
      sourceUrl: item.sourceUrl,
      summary: item.summary,
      topic: item.topic,
      updatedAt: item.updatedAt
    }));

    const total = podcastTotal;

    // 如果是热度排序，需要根据访问次数重新排序
    if (type === 'hot') {
      // 一次性获取所有项目的访问次数，避免N+1查询
      const itemIds = items.map(item => item.id);
      
      // 批量查询访问次数（只查询Podcast表的访问记录）
      const accessCounts = await prisma.accessLog.groupBy({
        by: ['podcastId'],
        where: {
          podcastId: { in: itemIds }
        },
        _count: {
          id: true
        }
      });

      // 创建访问次数映射
      const accessCountMap = new Map<string, number>();
      accessCounts.forEach(access => {
        if (access.podcastId) {
          accessCountMap.set(access.podcastId, access._count.id);
        }
      });

      // 为每个项目添加访问次数
      const itemsWithAccessCount = items.map(item => ({
        ...item,
        accessCount: accessCountMap.get(item.id) || 0
      }));

      // 按访问次数降序排序，访问次数相同时按更新时间降序排序
      items = itemsWithAccessCount
        .sort((a, b) => {
          if (b.accessCount !== a.accessCount) {
            return b.accessCount - a.accessCount;
          }
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
        .slice(offset, offset + limit);
    }

    const response = {
      items: items.map(item => ({
        id: item.id,
        title: item.title,
        author: item.showAuthor,
        publishedAt: item.publishedAt,
        audioUrl: item.audioUrl,
        originalUrl: item.sourceUrl,
        summary: item.summary,
        topic: item.topic?.name || null,
        updatedAt: item.updatedAt,
        accessCount: 0
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    };

    // latest: 实时返回并显式禁用缓存
    if (type === 'latest') {
      const res = NextResponse.json(response);
      res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.headers.set('Pragma', 'no-cache');
      res.headers.set('Expires', '0');
      return res;
    }

    // 非 latest: 缓存结果（不同类型使用不同的TTL）
    // hot 使用 T+1 较长缓存（默认3小时），其余适中（5分钟）
    const ttl = type === 'hot' ? 3 * 60 * 60 * 1000 : 5 * 60 * 1000;
    await cache.set(cacheKey, response, ttl);

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error);
  }
}