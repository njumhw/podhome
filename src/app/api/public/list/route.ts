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
    // 但只对确实重复的播客进行去重，避免过度去重
    const seen = new Map<string, any>();
    for (const item of podcastItemsRaw) {
      const key = item.sourceUrl || item.id;
      const prev = seen.get(key);
      if (!prev || new Date(item.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
        seen.set(key, item);
      }
    }
    const podcastItems = Array.from(seen.values());
    
    // 如果去重后数量显著减少，记录警告
    if (podcastItemsRaw.length > 0 && podcastItems.length < podcastItemsRaw.length * 0.5) {
      console.warn(`播客去重：原始 ${podcastItemsRaw.length} 个，去重后 ${podcastItems.length} 个`);
    }

    // 格式化数据
    let items = podcastItems.map(item => ({
      id: item.id,
      title: item.title || '未知标题',
      author: item.showAuthor || null, // 前端期望author字段
      showAuthor: item.showAuthor || null, // 保持兼容性
      publishedAt: item.publishedAt,
      audioUrl: item.audioUrl,
      sourceUrl: item.sourceUrl,
      summary: item.summary,
      topic: item.topic,
      updatedAt: item.updatedAt,
      likeCount: 0 // 默认0，hot分支会用聚合结果覆盖
    }));

    const total = podcastTotal;

    // 如果是热度排序，需要先获取所有数据，然后按点赞数排序，最后去重
    if (type === 'hot') {
      // 先获取更多数据，因为需要去重
      const hotItemsRaw = await prisma.podcast.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          showAuthor: true,
          publishedAt: true,
          audioUrl: true,
          sourceUrl: true,
          summary: true,
          updatedAt: true,
          topic: { select: { name: true } },
          _count: { select: { likes: true } }
        },
        take: limit * 3 // 获取更多数据，因为需要去重
      });

      // 去重：同一 sourceUrl 仅保留点赞数最多或最新的那条
      const seen = new Map<string, any>();
      for (const item of hotItemsRaw) {
        const key = item.sourceUrl || item.id;
        const prev = seen.get(key);
        if (!prev) {
          seen.set(key, item);
        } else {
          // 比较点赞数，如果相同则比较更新时间
          const prevLikes = prev._count?.likes || 0;
          const currLikes = item._count?.likes || 0;
          if (currLikes > prevLikes || 
              (currLikes === prevLikes && new Date(item.updatedAt).getTime() > new Date(prev.updatedAt).getTime())) {
            seen.set(key, item);
          }
        }
      }
      
      const hotItemsUnique = Array.from(seen.values());
      
      // 按点赞数排序，然后按更新时间排序
      hotItemsUnique.sort((a, b) => {
        const aLikes = a._count?.likes || 0;
        const bLikes = b._count?.likes || 0;
        if (aLikes !== bLikes) {
          return bLikes - aLikes; // 点赞数降序
        }
        // 点赞数相同，按更新时间降序
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      // 取前limit个
      items = hotItemsUnique.slice(0, limit).map(i => ({
        id: i.id,
        title: i.title,
        author: i.showAuthor || null, // 前端期望author字段
        showAuthor: i.showAuthor || null, // 保持兼容性
        publishedAt: i.publishedAt,
        audioUrl: i.audioUrl,
        sourceUrl: i.sourceUrl,
        summary: i.summary,
        updatedAt: i.updatedAt,
        topic: i.topic,
        likeCount: i._count?.likes || 0
      }));
      
      // 更新total为去重后的数量
      const uniqueTotal = await prisma.podcast.groupBy({
        by: ['sourceUrl'],
        where: whereClause,
        _count: true
      });
      // 注意：这里total可能不准确，但至少不会显示重复
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
        likeCount: item.likeCount || 0
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

    // 所有列表都使用缓存，但频率不同
    let ttl: number;
    let cacheControl: string;
    
    if (type === 'latest') {
      // 最新列表：10分钟更新一次
      ttl = 10 * 60 * 1000; // 10分钟
      cacheControl = 'public, max-age=600, s-maxage=600, stale-while-revalidate=300';
    } else if (type === 'hot') {
      // 最热列表：30分钟更新一次（点赞变化不频繁）
      ttl = 30 * 60 * 1000; // 30分钟
      cacheControl = 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=600';
    } else {
      // 其他列表：15分钟更新一次
      ttl = 15 * 60 * 1000; // 15分钟
      cacheControl = 'public, max-age=900, s-maxage=900, stale-while-revalidate=300';
    }
    
    // 缓存结果
    await cache.set(cacheKey, response, ttl);

    const res = NextResponse.json(response);
    res.headers.set('Cache-Control', cacheControl);
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}