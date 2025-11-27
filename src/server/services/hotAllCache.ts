import { db } from '@/server/db';
import { cache, cacheKeys } from '@/utils/cache';

const HOT_ALL_LIMIT_DEFAULT = 10;
export const HOT_ALL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const buildCacheKey = (limit: number, includeSummary: boolean) =>
  `${cacheKeys.podcastList('hot_all', undefined, 1, limit)}:${includeSummary ? 'summary' : 'basic'}`;

export async function buildHotAllResponse(limit = HOT_ALL_LIMIT_DEFAULT, includeSummary = false) {
  const itemsRaw = await db.podcast.findMany({
    where: { status: 'READY' },
    select: {
      id: true,
      title: true,
      showAuthor: true,
      publishedAt: true,
      audioUrl: true,
      sourceUrl: true,
      updatedAt: true,
      topic: { select: { name: true } },
      ...(includeSummary ? { summary: true } : {}),
      _count: { select: { likes: true } }
    },
    orderBy: {
      likes: {
        _count: 'desc'
      }
    },
    take: Math.max(limit, 50)
  });

  const items = itemsRaw.map(item => ({
    id: item.id,
    title: item.title,
    author: item.showAuthor,
    publishedAt: item.publishedAt,
    audioUrl: item.audioUrl,
    originalUrl: item.sourceUrl,
    summary: includeSummary ? (item as any).summary ?? null : null,
    topic: item.topic?.name || null,
    updatedAt: item.updatedAt,
    likeCount: item._count?.likes || 0
  }));

  return {
    response: {
      items: items.slice(0, limit),
      pagination: {
        page: 1,
        limit,
        total: itemsRaw.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    },
    cacheKey: buildCacheKey(limit, includeSummary)
  };
}

export async function refreshHotAllCache(limit = HOT_ALL_LIMIT_DEFAULT, includeSummary = false) {
  const { response, cacheKey } = await buildHotAllResponse(limit, includeSummary);
  await cache.set(cacheKey, response, HOT_ALL_CACHE_TTL);
  return response;
}


