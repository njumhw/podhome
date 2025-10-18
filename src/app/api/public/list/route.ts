import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';
import { cache, cacheKeys } from '@/utils/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'latest'; // latest, hot, topics
    const topic = searchParams.get('topic');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 检查缓存
    const cacheKey = cacheKeys.podcastList(type, topic, page, limit);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    let whereClause: any = {};
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

    // 构建AudioCache的查询条件
    let audioCacheWhere: any = {
      // 只返回有访谈全文和标题的播客（报告可以为空）
      script: { not: null },
      title: { not: null }
    };
    
    // 如果有主题筛选，添加到AudioCache查询条件中
    if (topicId) {
      audioCacheWhere.topicId = topicId;
    }

      // 同时查询Podcast表和AudioCache表
      const [podcastItems, podcastTotal, audioCacheItems, audioCacheTotal] = await Promise.all([
        prisma.podcast.findMany({
          where: whereClause,
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
      prisma.podcast.count({ where: whereClause }),
      prisma.audioCache.findMany({
        where: audioCacheWhere,
        select: {
          id: true,
          title: true,
          author: true,
          publishedAt: true,
          audioUrl: true,
          summary: true,
          topic: { select: { name: true } },
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.audioCache.count({
        where: audioCacheWhere
      })
    ]);

    // 合并两个表的结果
    let items: any[] = [];
    let total = 0;

    // 优先使用Podcast表的数据
    if (podcastTotal > 0) {
      items = podcastItems;
      total = podcastTotal;
    } else {
      // 如果Podcast表没有数据，使用AudioCache表的数据
      items = audioCacheItems.map(item => ({
        id: item.id,
        title: item.title || '未知标题',
        showAuthor: item.author || '未知作者',
        publishedAt: item.publishedAt,
        audioUrl: item.audioUrl,
        sourceUrl: item.audioUrl, // 暂时使用audioUrl，后续会改进
        summary: item.summary,
        topic: item.topic,
        updatedAt: item.updatedAt
      }));
      total = audioCacheTotal;
    }

    // 如果是热度排序，需要根据访问次数重新排序
    if (type === 'hot') {
      // 一次性获取所有项目的访问次数，避免N+1查询
      const itemIds = items.map(item => item.id);
      
      // 批量查询访问次数
      const accessCounts = await prisma.accessLog.groupBy({
        by: ['podcastId', 'audioCacheId'],
        where: {
          OR: [
            { podcastId: { in: itemIds } },
            { audioCacheId: { in: itemIds } }
          ]
        },
        _count: {
          id: true
        }
      });

      // 创建访问次数映射
      const accessCountMap = new Map<string, number>();
      accessCounts.forEach(access => {
        const id = access.podcastId || access.audioCacheId;
        if (id) {
          accessCountMap.set(id, access._count.id);
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
        accessCount: item.accessCount || 0
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

    // 缓存结果（不同类型使用不同的TTL）
    const ttl = type === 'hot' ? 2 * 60 * 1000 : 5 * 60 * 1000; // 热度排序2分钟，其他5分钟
    await cache.set(cacheKey, response, ttl);

    return NextResponse.json(response);
  } catch (error) {
    console.error('List error:', error);
    console.error('Error details:', error.message);
    return NextResponse.json(
      { error: '获取列表失败', details: error.message },
      { status: 500 }
    );
  }
}