import { NextRequest, NextResponse } from 'next/server';
import { db as prisma, checkDatabaseHealth, reconnectDatabase } from '@/server/db';
import { cache, cacheKeys } from '@/utils/cache';
import { handleApiError, withRetry } from '@/utils/error-handler';
import { withQueryTimeout } from '@/utils/query-timeout';
import '@/server/jobs/hotAllScheduler';
import { refreshHotAllCache, HOT_ALL_CACHE_TTL, buildHotAllResponse } from '@/server/services/hotAllCache';

const LATEST_LOOKBACK_DAYS = 7;
const HOT_LOOKBACK_DAYS = 30;

export async function GET(request: NextRequest) {
  // 确保所有错误都返回JSON，而不是HTML
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'latest'; // latest, hot, hot_all, topics
    const topic = searchParams.get('topic');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const includeSummary = searchParams.get('includeSummary') === 'true';
    
    console.log(`[API /api/public/list] 请求参数: type=${type}, page=${page}, limit=${limit}, topic=${topic || 'none'}`);
    const startTime = Date.now();

    // 检查缓存
    // latest类型使用30秒短期缓存，平衡实时性和性能
    // hot类型使用短期缓存（5分钟），因为排序计算较慢
    const cacheKey = `${cacheKeys.podcastList(type, topic || undefined, page, limit)}:${includeSummary ? 'summary' : 'basic'}`;
    
    // 所有类型都使用缓存，但latest类型使用更短的TTL（30秒）
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log(`[API /api/public/list] 使用缓存: type=${type}, 缓存命中`);
      return NextResponse.json(cached);
    }
    
    // 对于hot类型，如果查询失败，尝试返回缓存（即使过期）
    let fallbackCache: unknown = null;
    if (type === 'hot' || type === 'hot_all') {
      try {
        // 尝试获取缓存（即使可能已过期，也尝试获取）
        fallbackCache = await cache.get(cacheKey);
      } catch (e) {
        // 忽略缓存错误
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
    const podcastWhere = { ...whereClause };
    let optimizedWhere = podcastWhere;
    
    if (type === 'latest') {
      // 优先查询最近7天的数据，如果不足则fallback到全部数据
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - LATEST_LOOKBACK_DAYS);
      optimizedWhere = {
        ...podcastWhere,
        createdAt: {
          gte: sevenDaysAgo
        }
      };
      console.log(`[API /api/public/list] latest类型：优先查询最近${LATEST_LOOKBACK_DAYS}天的数据`);
    }
    
    // 为查询添加超时保护（25秒，给数据库更多时间）
    const QUERY_TIMEOUT = 25000;
    let podcastItemsRaw: any[] = [];
    let podcastTotal = 0;
    
    try {
      // 简化查询逻辑，直接查询，不使用Promise.race（避免超时逻辑干扰）
      console.log(`[API /api/public/list] 开始查询数据库: type=${type}, where=${JSON.stringify(optimizedWhere)}`);
      
      const queryStartTime = Date.now();
      
      // 使用查询超时，防止慢查询阻塞
      // 先查询数据，count查询可以异步进行（对于latest类型直接跳过count）
      const selectFields: Record<string, any> = {
        id: true,
        title: true,
        showAuthor: true,
        publishedAt: true,
        audioUrl: true,
        sourceUrl: true,
        topic: { select: { name: true } },
        updatedAt: true,
        createdAt: true
      };
      
      if (includeSummary) {
        selectFields.summary = true;
      }
      
      // 使用查询超时，防止慢查询阻塞
      const items = await withQueryTimeout(
        () => prisma.podcast.findMany({
          where: optimizedWhere,
          select: selectFields,
          orderBy,
          skip: offset,
          take: limit
        }),
        15000, // 15秒超时
        `${type}类型播客查询超时`
      ).catch((error) => {
        console.error(`[API /api/public/list] ${type}类型查询失败:`, error);
        // 查询失败时返回空数组，避免整个API失败
        return [];
      });
      
      // 对于latest类型，使用估算值而不是精确count（提高性能）
      const total = type === 'latest' 
        ? limit * 10 // 估算值，避免慢查询
        : await withQueryTimeout(
            () => prisma.podcast.count({ where: optimizedWhere }),
            10000, // count查询10秒超时
            'count查询超时'
          ).catch(() => items.length); // count失败时使用items.length作为估算值
      
      const queryEndTime = Date.now();
      console.log(`[API /api/public/list] 数据库查询完成: 耗时=${queryEndTime - queryStartTime}ms, 返回${items.length}条数据`);
      
      podcastItemsRaw = items;
      podcastTotal = total;

      if (type === 'latest' && items.length < limit) {
        console.log(`[API /api/public/list] latest 近 ${LATEST_LOOKBACK_DAYS} 天数据不足（${items.length}/${limit}），执行回退查询全部数据`);
        const fallbackItems = await withQueryTimeout(
          () => prisma.podcast.findMany({
            where: podcastWhere,
            select: selectFields,
            orderBy,
            skip: offset,
            take: limit
          }),
          15000,
          'latest回退查询超时'
        ).catch((error) => {
          console.error(`[API /api/public/list] latest回退查询失败:`, error);
          return items; // 如果回退查询失败，使用原始结果
        });
        podcastItemsRaw = fallbackItems;
        // 使用实际查询结果的数量作为总数估算
        podcastTotal = Math.max(fallbackItems.length, limit * 2);
        console.log(`[API /api/public/list] latest回退查询完成: 返回${fallbackItems.length}条数据`);
      }
    } catch (dbError: any) {
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      console.error(`[API /api/public/list] 数据库查询失败: type=${type}, error=${errorMessage}`);
      
      // 如果是超时或连接错误，尝试返回过期缓存或空结果
      if (errorMessage.includes('超时') || 
          errorMessage.includes('timeout') || 
          errorMessage.includes('Can\'t reach database') ||
          errorMessage.includes('connection') ||
          errorMessage.includes('P1001') ||
          errorMessage.includes('P1002') ||
          errorMessage.includes('P1017')) {
        console.error(`[API /api/public/list] 数据库连接问题，尝试返回过期缓存或空结果`);
        
        // 尝试重新连接数据库（异步，不阻塞响应）
        setImmediate(async () => {
          try {
            const isHealthy = await checkDatabaseHealth();
            if (!isHealthy) {
              console.log('[API /api/public/list] 数据库不健康，尝试重新连接...');
              await reconnectDatabase();
            }
          } catch (reconnectError) {
            console.error('[API /api/public/list] 数据库重连失败:', reconnectError);
          }
        });
        
        // 如果有过期缓存，返回它
        if (fallbackCache && typeof fallbackCache === 'object') {
          console.log(`[API /api/public/list] 返回过期缓存作为降级方案`);
          return NextResponse.json(fallbackCache);
        }
        
        podcastItemsRaw = [];
        podcastTotal = 0;
      } else {
        // 其他错误继续抛出
        throw dbError;
      }
    }
    
    const queryTime = Date.now() - startTime;
    console.log(`[API /api/public/list] 查询结果: type=${type}, 原始数量=${podcastItemsRaw.length}, 总数=${podcastTotal}, 查询耗时=${queryTime}ms`);

    // 去重：同一 sourceUrl 仅保留最新的一条
    // 但只对确实重复的播客进行去重，避免过度去重
    const seen = new Map<string, any>();
    for (const item of podcastItemsRaw) {
      const key = item.sourceUrl || item.id;
      const prev = seen.get(key);
      // 对于 latest 类型，使用 createdAt 比较；其他类型使用 updatedAt
      const compareField = type === 'latest' ? 'createdAt' : 'updatedAt';
      const itemTime = new Date(item[compareField] || item.updatedAt).getTime();
      const prevTime = prev ? new Date(prev[compareField] || prev.updatedAt).getTime() : 0;
      if (!prev || itemTime > prevTime) {
        seen.set(key, item);
      }
    }
    const podcastItems = Array.from(seen.values());
    
    // 如果去重后数量显著减少，记录警告
    if (podcastItemsRaw.length > 0 && podcastItems.length < podcastItemsRaw.length * 0.5) {
      console.warn(`[API /api/public/list] 播客去重：原始 ${podcastItemsRaw.length} 个，去重后 ${podcastItems.length} 个`);
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
      summary: includeSummary ? item.summary : null,
      topic: item.topic,
      updatedAt: item.updatedAt,
      likeCount: 0 // 默认0，hot分支会用聚合结果覆盖
    }));

    let total = podcastTotal;

    // 如果是热度排序，使用优化的数据库查询
    if (type === 'hot' || type === 'hot_all') {
      if (type === 'hot_all') {
        try {
          const { response } = await buildHotAllResponse(limit, includeSummary);
          items = response.items.map(item => ({
          id: item.id,
          title: item.title,
          author: item.author,
          showAuthor: item.author,
          publishedAt: item.publishedAt,
          audioUrl: item.audioUrl,
          sourceUrl: item.originalUrl,
          summary: item.summary,
          updatedAt: item.updatedAt,
          topic: item.topic ? { name: item.topic } : null,
          likeCount: item.likeCount || 0
        }));
        total = response.pagination.total;
        } catch (hotAllError: any) {
          console.error(`[API /api/public/list] hot_all查询失败:`, hotAllError);
          // 查询失败时返回空结果
          items = [];
          total = 0;
        }
      } else {
        const hotLookbackDate = new Date();
        hotLookbackDate.setDate(hotLookbackDate.getDate() - HOT_LOOKBACK_DAYS);
        
        const optimizedHotWhere = {
          ...whereClause,
          updatedAt: { gte: hotLookbackDate }
        };
        
        const hotSelectFields: Record<string, any> = {
          id: true,
          title: true,
          showAuthor: true,
          publishedAt: true,
          audioUrl: true,
          sourceUrl: true,
          updatedAt: true,
          topic: { select: { name: true } },
          _count: { select: { likes: true } }
        };
        
        if (includeSummary) {
          hotSelectFields.summary = true;
        }
        
        // 使用查询超时，防止慢查询阻塞
        const hotItemsRaw = await withQueryTimeout(
          () => prisma.podcast.findMany({
            where: optimizedHotWhere,
            select: hotSelectFields,
            orderBy: { updatedAt: 'desc' },
            take: Math.min(200, Math.max(limit * 4, 60))
          }),
          15000, // 15秒超时
          '热门播客查询超时'
        ).catch((error) => {
          console.error(`[API /api/public/list] 热门播客查询失败:`, error);
          // 查询失败时返回空数组，避免整个API失败
          return [];
        });
        
        console.log(`[API /api/public/list] 热度排序（优化后）：获取到 ${hotItemsRaw.length} 条播客数据（最近${HOT_LOOKBACK_DAYS}天）`);
        
        // 类型定义：确保类型安全
        type HotItem = {
          id: string;
          sourceUrl: string | null;
          updatedAt: Date;
          _count: { likes: number } | undefined;
          [key: string]: any; // 允许其他字段
        };
        
        const seen = new Map<string, HotItem>();
        for (const item of hotItemsRaw) {
          // 确保 key 是字符串类型
          const sourceUrl = (item as any).sourceUrl;
          const key: string = (sourceUrl && typeof sourceUrl === 'string' ? String(sourceUrl) : null) || String(item.id);
          const prev = seen.get(key);
          const itemAsHotItem = item as unknown as HotItem;
          if (!prev) {
            seen.set(key, itemAsHotItem);
          } else {
            const prevLikes = (prev._count as { likes?: number })?.likes || 0;
            const currLikes = (itemAsHotItem._count as { likes?: number })?.likes || 0;
            const prevUpdatedAt = prev.updatedAt instanceof Date ? prev.updatedAt : new Date(prev.updatedAt);
            const itemUpdatedAt = itemAsHotItem.updatedAt instanceof Date ? itemAsHotItem.updatedAt : new Date(itemAsHotItem.updatedAt);
            if (currLikes > prevLikes || 
                (currLikes === prevLikes && itemUpdatedAt.getTime() > prevUpdatedAt.getTime())) {
              seen.set(key, itemAsHotItem);
            }
          }
        }
        
        const hotItemsUnique = Array.from(seen.values());
        hotItemsUnique.sort((a, b) => {
          const aLikes = (a._count as { likes?: number })?.likes || 0;
          const bLikes = (b._count as { likes?: number })?.likes || 0;
          const aUpdatedAt = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
          const bUpdatedAt = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
          if (aLikes !== bLikes) {
            return bLikes - aLikes;
          }
          return bUpdatedAt.getTime() - aUpdatedAt.getTime();
        });

        items = hotItemsUnique.slice(0, limit).map(i => ({
          id: i.id,
          title: i.title || '未知标题',
          author: i.showAuthor || null,
          showAuthor: i.showAuthor || null,
          publishedAt: i.publishedAt,
          audioUrl: i.audioUrl,
          sourceUrl: i.sourceUrl,
          summary: includeSummary ? (i as any).summary : null,
          updatedAt: i.updatedAt,
          topic: i.topic,
          likeCount: (i._count as { likes?: number })?.likes || 0
        }));
        
        total = hotItemsUnique.length;
      }
    }
    
    console.log(`[API /api/public/list] 最终返回数量: ${items.length}, 总数: ${total}, 类型: ${type}`);

    const response = {
      items: items.map(item => ({
        id: item.id,
        title: item.title,
        author: item.showAuthor,
        publishedAt: item.publishedAt,
        audioUrl: item.audioUrl,
        originalUrl: item.sourceUrl,
        summary: includeSummary ? item.summary : null,
        topic: item.topic?.name || null,
        updatedAt: item.updatedAt,
        likeCount: item.likeCount || 0
      })),
      pagination: {
        page,
        limit,
        total: total || items.length, // 确保total不为0（如果查询失败，使用items.length作为fallback）
        totalPages: Math.ceil((total || items.length) / limit),
        hasNext: offset + limit < (total || items.length),
        hasPrev: page > 1
      }
    };
    
    console.log(`[API /api/public/list] 响应数据: items=${response.items.length}, pagination.total=${response.pagination.total}, hasNext=${response.pagination.hasNext}`);

    // 缓存策略：latest 类型使用30秒短期缓存，平衡实时性和性能
    let ttl: number;
    let cacheControl: string;
    
    if (type === 'latest') {
      // latest类型使用30秒短期缓存，平衡实时性和性能
      ttl = 30 * 1000; // 30秒
      cacheControl = 'public, max-age=30, s-maxage=30, stale-while-revalidate=10';
      await cache.set(cacheKey, response, ttl);
    } else if (type === 'hot') {
      ttl = 5 * 60 * 1000; // 5分钟
      cacheControl = 'public, max-age=300, s-maxage=300, stale-while-revalidate=60';
      await cache.set(cacheKey, response, ttl);
    } else if (type === 'hot_all') {
      ttl = HOT_ALL_CACHE_TTL;
      cacheControl = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=600';
      await cache.set(cacheKey, response, ttl);
    } else {
      ttl = 15 * 60 * 1000; // 15分钟
      cacheControl = 'public, max-age=900, s-maxage=900, stale-while-revalidate=300';
      await cache.set(cacheKey, response, ttl);
    }

    const res = NextResponse.json(response);
    res.headers.set('Cache-Control', cacheControl);
    return res;
  } catch (error: any) {
    // 确保所有错误都返回JSON
    console.error(`[API /api/public/list] 未捕获的错误:`, error);
    
    // 检查是否是数据库连接错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    // 数据库连接错误
    if (errorMessage.includes('Can\'t reach database') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('P1001') ||
        errorMessage.includes('P1002') ||
        errorMessage.includes('P1017') ||
        errorCode === 'P1001' ||
        errorCode === 'P1002' ||
        errorCode === 'P1017' ||
        errorName === 'PrismaClientInitializationError') {
      console.error('[API /api/public/list] 数据库连接错误，返回503 JSON响应');
      return NextResponse.json(
        { error: '数据库连接失败', code: 'DB_CONNECTION_ERROR' },
        { status: 503 }
      );
    }
    
    // 使用统一的错误处理
    return handleApiError(error);
  }
}