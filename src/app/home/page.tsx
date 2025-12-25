"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { useUser } from '@/hooks/useUser';
import UpgradeModal from '@/components/UpgradeModal';
import { PodcastCard } from '@/components/PodcastCard';
import MinimalLikeButton from '@/components/MinimalLikeButton';
import { AnimatedDotGrid } from '@/components/AnimatedDotGrid';

type PodcastItem = {
  id: string;
  title: string;
  author: string;
  publishedAt: string | null;
  audioUrl: string;
  originalUrl: string;
  summary: string | null;
  topic: string | null;
  updatedAt: string;
  likeCount?: number;
  likedAt?: string | null;
};

type SearchResult = {
  hits: PodcastItem[];
  notFound: boolean;
};

type ListResult = {
  items: PodcastItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};


export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useUser();
  const toast = useToast();

  const LATEST_INITIAL_LIMIT = 30; // 一次性加载30个，避免先显示4个再显示9个的问题
  const LATEST_PREFETCH_LIMIT = 60;
  const [latest, setLatest] = useState<PodcastItem[]>([]);
  const [latestDisplayCount, setLatestDisplayCount] = useState(0); // 默认先不显示，数据返回后再设置
  const [latestHasMore, setLatestHasMore] = useState(false); // 是否还有更多数据
  const [latestPrefetched, setLatestPrefetched] = useState(false);
  const MAX_DISPLAY_COUNT = 30; // 最大显示数量上限，避免性能问题
  const latestPrefetchPromiseRef = useRef<Promise<PodcastItem[] | null> | null>(null);
  const [hot, setHot] = useState<PodcastItem[]>([]);
  const [hotMode, setHotMode] = useState<'30d' | 'all'>('30d');
  const [hotDisplayCount, setHotDisplayCount] = useState(9); // 默认显示9个
  const [hotHasMore, setHotHasMore] = useState(false); // 是否还有更多数据
  const [loading, setLoading] = useState({ latest: false, hot: false });
  const [activeTab, setActiveTab] = useState<'new' | 'top' | 'liked'>('new');
  const [likedItems, setLikedItems] = useState<PodcastItem[]>([]);
  const [likedPage, setLikedPage] = useState(1);
  const [likedHasMore, setLikedHasMore] = useState(true);
  const [likedLoading, setLikedLoading] = useState(false);
  const [likedDisplayCount, setLikedDisplayCount] = useState(9); // 默认显示9个
  const LIKED_PAGE_SIZE = 6; // 每次加载6个
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [catalogSummary, setCatalogSummary] = useState<{ totalPodcasts: number; totalMinutes: number } | null>(null);
  const [summaryDisplay, setSummaryDisplay] = useState<{ podcasts: number; hours: number }>({ podcasts: 0, hours: 0 });
  const tabOptions: Array<{ id: 'new' | 'top' | 'liked'; label: string; icon: string; requiresAuth?: boolean }> = [
    { id: 'new', label: 'New', icon: '#' },
    { id: 'top', label: 'Top', icon: '⚡' },
    { id: 'liked', label: 'Liked', icon: '❤', requiresAuth: true },
  ];

  // 加载主题列表

  // 带超时的 fetch（超时时间增加到 60 秒）
  const fetchWithTimeout = async (url: string, timeout = 60000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('[fetchWithTimeout] 请求超时:', url);
        return new Response(
          JSON.stringify({ error: 'Request timeout', url }),
          {
            status: 408,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      throw error;
    }
  };

  // 带重试机制的 fetch（自动重试 2-3 次）
  const fetchWithRetry = async (
    url: string,
    options: { maxRetries?: number; retryDelay?: number; timeout?: number } = {}
  ): Promise<Response> => {
    const { maxRetries = 3, retryDelay = 2000, timeout = 60000 } = options;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchWithTimeout(url, timeout);
        
        // 如果是 5xx 服务器错误，重试
        if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
          console.warn(`[fetchWithRetry] 服务器错误 ${response.status}，第 ${attempt}/${maxRetries} 次重试:`, url);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }
        
        // 如果是 408 超时错误，重试
        if (response.status === 408 && attempt < maxRetries) {
          console.warn(`[fetchWithRetry] 请求超时，第 ${attempt}/${maxRetries} 次重试:`, url);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }
        
        return response;
      } catch (error: any) {
        lastError = error;
        
        // 网络错误或超时，重试
        if (attempt < maxRetries) {
          const isNetworkError = 
            error.name === 'AbortError' ||
            error.name === 'TypeError' ||
            error.message?.includes('fetch') ||
            error.message?.includes('network') ||
            error.message?.includes('Failed to fetch');
          
          if (isNetworkError) {
            console.warn(`[fetchWithRetry] 网络错误，第 ${attempt}/${maxRetries} 次重试:`, url, error.message);
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }
        }
        
        // 最后一次尝试失败，抛出错误
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    
    throw lastError || new Error('请求失败');
  };

  const prefetchLatest = (limit = LATEST_PREFETCH_LIMIT, options?: { resetDisplay?: boolean; force?: boolean }): Promise<PodcastItem[] | null> => {
    if (!options?.force) {
      if (limit <= LATEST_PREFETCH_LIMIT && latestPrefetched) {
        return Promise.resolve(latest);
      }
      if (latestPrefetchPromiseRef.current) {
        return latestPrefetchPromiseRef.current;
      }
    }

    const fetchTask = (async () => {
      try {
        const res = await fetchWithRetry(`/api/public/list?type=latest&limit=${limit}`, { maxRetries: 2, retryDelay: 2000 });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[首页] 预加载最新播客失败:', res.status, errorText);
          return null;
        }
        const data: ListResult = await res.json();
        const items = data.items || [];
        setLatest(items);
        if (options?.resetDisplay) {
          // 重置时，如果数据足够，显示9个；否则显示实际数量
          const resetCount = items.length >= LATEST_INITIAL_LIMIT ? LATEST_INITIAL_LIMIT : items.length;
          setLatestDisplayCount(resetCount);
        } else {
          setLatestDisplayCount(prev => {
            if (prev === 0 && items.length > 0) {
              // 初始加载：如果数据足够，显示9个；否则显示实际数量
              return items.length >= LATEST_INITIAL_LIMIT ? LATEST_INITIAL_LIMIT : items.length;
            }
            // 预加载时：如果已经设置了显示数量，不要减少它；如果数据更多，可以增加
            if (prev >= LATEST_INITIAL_LIMIT) {
              return prev; // 保持当前显示数量，不减少
            }
            // 如果当前显示数量小于9，且数据足够，设置为9
            if (items.length >= LATEST_INITIAL_LIMIT && prev < LATEST_INITIAL_LIMIT) {
              return LATEST_INITIAL_LIMIT;
            }
            return Math.min(prev, items.length);
          });
        }
        setLatestHasMore(data.pagination?.hasNext || items.length >= limit);
        if (limit >= LATEST_PREFETCH_LIMIT) {
          setLatestPrefetched(true);
        }
        return items;
      } catch (error) {
        console.error('预加载最新播客失败:', error);
        return null;
      }
    })();

    const wrappedPromise = fetchTask
      .then((result) => {
        latestPrefetchPromiseRef.current = null;
        return result;
      })
      .catch((error) => {
        latestPrefetchPromiseRef.current = null;
        throw error;
      });

    latestPrefetchPromiseRef.current = wrappedPromise;
    return wrappedPromise;
  };

  // 加载首页数据 - 优化加载顺序：关键数据优先
  useEffect(() => {
    const loadInitialData = async () => {
      const timestamp = Date.now();

      // 关键数据优先加载：latest列表和summary
      setLoading(prev => ({ ...prev, latest: true, hot: false })); // hot延迟加载

      // 1. 优先加载latest列表（主页核心内容）- 一次性加载30个，避免分步加载
      try {
        const latestRes = await fetchWithRetry(`/api/public/list?type=latest&limit=${LATEST_INITIAL_LIMIT}&_t=${timestamp}`, { 
          maxRetries: 3, 
          retryDelay: 2000 
        });
        
        if (latestRes.ok) {
          const data = await latestRes.json();
          const items = data.items || [];
          console.log('[首页] 获取最新播客数据:', {
            itemsCount: items.length,
            pagination: data.pagination,
            hasNext: data.pagination?.hasNext
          });
          setLatest(items);
          // 一次性显示所有数据（最多30个），避免先显示4个再显示9个的问题
          const initialCount = Math.min(items.length, MAX_DISPLAY_COUNT);
          console.log('[首页] 设置显示数量:', initialCount, '实际数据:', items.length);
          setLatestDisplayCount(initialCount);
          setLatestHasMore(data.pagination?.hasNext || items.length >= LATEST_INITIAL_LIMIT);
          // 如果数据不足30个，后台预加载更多数据
          if (items.length < LATEST_INITIAL_LIMIT) {
            prefetchLatest();
          }
        } else {
          const errorText = await latestRes.text();
          console.error('[首页] 获取最新播客失败:', latestRes.status, errorText);
          setLatest([]);
          setLatestDisplayCount(0);
          setLatestHasMore(false);
        }
      } catch (error) {
        console.error('[首页] 最新播客请求失败:', error);
        setLatest([]);
        setLatestDisplayCount(0);
        setLatestHasMore(false);
      } finally {
        setLoading(prev => ({ ...prev, latest: false }));
      }

      // 2. 延迟加载hot列表（非关键数据）
      setLoading(prev => ({ ...prev, hot: true }));
      try {
        const hotRes = await fetchWithRetry(`/api/public/list?type=hot&limit=15&_t=${timestamp}`, { 
          maxRetries: 2, 
          retryDelay: 2000 
        });
        
        if (hotRes.ok) {
          const data = await hotRes.json();
          const items = data.items || [];
          setHot(items);
          const defaultCount = items.length === 0 ? 0 : Math.min(9, items.length);
          setHotDisplayCount(defaultCount);
          setHotHasMore(data.pagination?.hasNext || items.length >= 15);
          setHotMode('30d');
        } else {
          const errorText = await hotRes.text();
          console.error('[首页] 获取热门播客失败:', hotRes.status, errorText);
          setHotHasMore(false);
        }
      } catch (error) {
        console.error('[首页] 获取热门播客失败:', error);
        setHotHasMore(false);
      } finally {
        setLoading(prev => ({ ...prev, hot: false }));
      }

    };

    loadInitialData().catch((error) => {
      console.error('[首页] 加载首页初始数据失败:', error);
      setLatest([]);
      setLatestDisplayCount(0);
      setLatestHasMore(false);
      setHotHasMore(false);
    });
  }, []);

  // 优先加载summary（主页关键数据）- 不使用force，直接读取缓存（后端会在播客处理完成后自动更新）
  useEffect(() => {
    const loadSummary = async () => {
      try {
        // 不使用force，直接读取缓存（后端会在播客处理完成后自动更新统计）
        // 添加时间戳避免浏览器缓存，但后端会返回缓存数据（如果可用）
        const res = await fetchWithRetry(`/api/public/summary?_t=${Date.now()}`, { 
          maxRetries: 2, // 减少重试次数，因为这是非关键数据
          retryDelay: 1000,
          timeout: 5000 // 5秒超时（减少超时时间，因为应该很快）
        });
        if (!res.ok) {
          console.error('[首页] 加载目录摘要失败: HTTP', res.status);
          // 即使失败也设置默认值，避免显示异常
          setCatalogSummary({
            totalPodcasts: 0,
            totalMinutes: 0,
          });
          return;
        }
        const data = await res.json();
        console.log('[首页] 目录摘要数据:', data);
        setCatalogSummary({
          totalPodcasts: data.totalPodcasts ?? 0,
          totalMinutes: data.totalDurationMinutes ?? Math.round((data.totalDurationSeconds ?? 0) / 60),
        });
      } catch (error) {
        console.error('[首页] 加载目录摘要失败:', error);
        // 即使失败也设置默认值
        setCatalogSummary({
          totalPodcasts: 0,
          totalMinutes: 0,
        });
      }
    };
    // 立即加载summary，不等待其他数据
    loadSummary();
  }, []);

  useEffect(() => {
    if (!catalogSummary) return;
    const targetPodcasts = catalogSummary.totalPodcasts;
    const targetHours = Math.max(0, Math.round((catalogSummary.totalMinutes ?? 0) / 60));
    const duration = 1500;
    const start = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = easeOutCubic(progress);
      setSummaryDisplay({
        podcasts: Math.round(targetPodcasts * eased),
        hours: Math.round(targetHours * eased),
      });
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [catalogSummary]);

  useEffect(() => {
    if (!user) {
      setLikedItems([]);
      setLikedPage(1);
      setLikedHasMore(true);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'liked' && user && likedItems.length === 0 && !likedLoading) {
      // 初始加载时，加载9个（如果少于9个就显示所有）
      fetchLikedPodcasts(1);
      setLikedDisplayCount(9); // 重置为9
    }
  }, [activeTab, user, likedItems.length, likedLoading]);

  useEffect(() => {
    // 当likedItems更新时，设置初始显示数量
    if (likedItems.length > 0) {
      // 如果当前显示数量是初始值9，且实际数据少于9个，显示所有
      if (likedDisplayCount === 9 && likedItems.length < 9) {
        setLikedDisplayCount(likedItems.length);
      }
      // 如果显示数量超过了实际数据量，调整到实际数据量
      else if (likedDisplayCount > likedItems.length && !likedHasMore) {
        // 只有在没有更多数据时才调整到实际数据量
        setLikedDisplayCount(likedItems.length);
      }
    }
  }, [likedItems.length, likedDisplayCount, likedHasMore]);

  const loadLatest = async () => {
    setLoading(prev => ({ ...prev, latest: true }));
    try {
      await prefetchLatest(LATEST_PREFETCH_LIMIT, { resetDisplay: true, force: true });
    } catch (error) {
      console.error('Failed to load latest:', error);
      setLatest([]);
      setLatestHasMore(false);
      setLatestDisplayCount(0);
    } finally {
      setLoading(prev => ({ ...prev, latest: false }));
    }
  };

  const handleLoadMoreLatest = async () => {
    const currentCount = latestDisplayCount;
    const nextCount = Math.min(currentCount + 6, MAX_DISPLAY_COUNT); // 每次加载6个，但不超过上限
    
    // 如果已达到上限，不再加载
    if (nextCount >= MAX_DISPLAY_COUNT && currentCount >= MAX_DISPLAY_COUNT) {
      return;
    }
    
    // 如果需要的数量超过当前加载的数量，先加载更多数据
    if (nextCount > latest.length) {
      try {
        const updatedItems = await prefetchLatest(Math.max(LATEST_PREFETCH_LIMIT, nextCount));
        const available = updatedItems?.length ?? latest.length;
        if (available >= nextCount) {
          setLatestDisplayCount(nextCount);
        } else if (available > latestDisplayCount) {
          setLatestDisplayCount(Math.min(available, MAX_DISPLAY_COUNT));
        }
      } catch (error) {
        console.error('Failed to load more latest:', error);
        if (latest.length >= nextCount) {
          setLatestDisplayCount(nextCount);
        }
      }
    } else {
      setLatestDisplayCount(nextCount);
      // 如果已达到上限，隐藏More按钮
      if (nextCount >= MAX_DISPLAY_COUNT) {
        setLatestHasMore(false);
      }
    }
  };

  const handleHotModeToggle = (mode: '30d' | 'all') => {
    if (mode === hotMode) return;
    loadHot(mode);
  };

  const normalizeLikedItem = (item: any, index: number): PodcastItem => {
    const source = item?.podcast ?? item ?? {};
    const idValue = source.id ?? item?.podcastId ?? item?.id ?? `liked-${index}`;
    const safeId = typeof idValue === 'string'
      ? idValue
      : typeof idValue === 'number'
        ? String(idValue)
        : (idValue?.id ? String(idValue.id) : `liked-${index}`);

    const topicValue = source.topic ?? source.topic?.name ?? item?.topic ?? item?.topic?.name ?? null;
    return {
      id: safeId,
      title: typeof source.title === 'string' ? source.title : (source.title?.text ?? '未知播客'),
      author: typeof (source.author ?? source.showAuthor) === 'string'
        ? (source.author ?? source.showAuthor)
        : '未知作者',
      publishedAt: source.publishedAt ?? item?.likedAt ?? item?.createdAt ?? null,
      audioUrl: typeof source.audioUrl === 'string' ? source.audioUrl : '',
      originalUrl: typeof (source.originalUrl ?? source.sourceUrl) === 'string'
        ? (source.originalUrl ?? source.sourceUrl)
        : '',
      summary: typeof source.summary === 'string' ? source.summary : '',
      topic: typeof topicValue === 'string' ? topicValue : null,
      updatedAt: source.updatedAt ?? item?.likedAt ?? item?.createdAt ?? new Date().toISOString(),
      likeCount: typeof (source.likeCount ?? source.likes) === 'number'
        ? (source.likeCount ?? source.likes)
        : 0,
      likedAt: item?.likedAt ?? item?.createdAt ?? null,
    };
  };

  const fetchLikedPodcasts = async (page = 1) => {
    if (!user) return;
    setLikedLoading(true);
    try {
      // 第一页加载9个，后续每页加载6个
      const limit = page === 1 ? 9 : LIKED_PAGE_SIZE;
      const offset = page === 1 ? 0 : 9 + (page - 2) * LIKED_PAGE_SIZE;
      const res = await fetch(`/api/podcast/liked?limit=${limit}&offset=${offset}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401) {
          toast.error('请登录后查看点赞播客');
        } else {
          toast.error('加载点赞播客失败');
        }
        // 修复：确保在错误时也设置空数组，避免显示空卡片
        if (page === 1) {
          setLikedItems([]);
        }
        setLikedHasMore(false);
        return;
      }
      const data = await res.json();
      const normalized = (data.items ?? []).map((item: any, index: number) =>
        normalizeLikedItem(item, offset + index)
      );
      // 修复：确保即使返回空数组也正确设置状态
      setLikedItems((prev) => page === 1 ? normalized : [...prev, ...normalized]);
      setLikedHasMore(data.pagination?.hasNext ?? false);
      setLikedPage(page);
    } catch (error) {
      console.error('加载点赞播客失败:', error);
      toast.error('加载点赞播客失败');
      // 修复：确保在错误时也设置空数组，避免显示空卡片
      if (page === 1) {
        setLikedItems([]);
      }
      setLikedHasMore(false);
    } finally {
      setLikedLoading(false);
    }
  };

  const handleLoadMoreLiked = async () => {
    // 如果已达到上限，不再加载
    if (likedDisplayCount >= MAX_DISPLAY_COUNT) {
      return;
    }
    
    if (likedHasMore && !likedLoading) {
      // 先加载更多数据
      await fetchLikedPodcasts(likedPage + 1);
      // 然后增加显示数量（每次6个），但不超过上限
      setLikedDisplayCount(prev => Math.min(prev + 6, MAX_DISPLAY_COUNT));
    } else if (!likedHasMore && likedDisplayCount < likedItems.length) {
      // 如果没有更多数据可加载，但还有未显示的数据，直接增加显示数量
      setLikedDisplayCount(prev => Math.min(prev + 6, Math.min(likedItems.length, MAX_DISPLAY_COUNT)));
    }
  };

  const handleLikedStatusChange = (podcastId: string, liked: boolean) => {
    if (!liked) {
      setLikedItems((prev) => prev.filter((item) => item.id !== podcastId));
    }
  };

  const renderNewSection = () => (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <svg className="w-5 h-5 text-[#ff9f43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        <h2 className="text-xl font-bold text-white dark:text-white [data-theme='light']:text-foreground font-mono">New</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent"></div>
      </div>

      {loading.latest ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-48 bg-zinc-900/40 border border-white/5 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : latest.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {latest.slice(0, latestDisplayCount).map((item) => (
              <PodcastCard key={item.id} item={item} />
            ))}
          </div>
          {(latestDisplayCount < latest.length || latestHasMore) && latestDisplayCount < MAX_DISPLAY_COUNT && (
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={handleLoadMoreLatest}
                disabled={loading.latest}
                className="px-6 py-2 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-card-surface backdrop-blur-sm border border-white/10 dark:border-white/10 [data-theme='light']:border-card-border hover:border-white/20 dark:hover:border-white/20 [data-theme='light']:hover:border-slate-300 hover:bg-zinc-900/60 dark:hover:bg-zinc-900/60 [data-theme='light']:hover:bg-slate-50 hover:shadow-lg hover:-translate-y-0.5 text-white dark:text-white [data-theme='light']:text-foreground rounded-lg transition-all font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.latest ? 'Loading...' : 'More'}
              </button>
            </div>
          )}
          {latestDisplayCount >= MAX_DISPLAY_COUNT && (
            <div className="mt-4 text-center text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-500 text-sm font-mono">
              已显示最多 {MAX_DISPLAY_COUNT} 个播客
            </div>
          )}
          
        </>
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-500 [data-theme='light']:text-slate-500 py-12 font-mono text-sm border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg bg-zinc-900/20 dark:bg-zinc-900/20 [data-theme='light']:bg-slate-50">
          Loading…
        </div>
      )}
    </div>
  );

  const renderTopSection = () => (
    <div className="relative">
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
        <div className="w-full h-full bg-gradient-radial from-[#ff6a00]/10 via-[#ff9f43]/5 to-transparent blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[#ff9f43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="text-xl font-bold text-white dark:text-white [data-theme='light']:text-foreground font-mono">Top</h2>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent"></div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleHotModeToggle('30d')}
            className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
              hotMode === '30d'
                ? 'bg-[#ff9f43]/30 border border-[#ff9f43]/50 text-slate-900 dark:text-white [data-theme="light"]:!text-slate-900'
                : 'bg-transparent border border-white/10 dark:border-white/10 [data-theme="light"]:border-slate-300 text-slate-900 dark:text-white/70 [data-theme="light"]:!text-slate-900 hover:border-white/30 dark:hover:border-white/30 [data-theme="light"]:hover:border-slate-400'
            }`}
          >
            近30天
          </button>
          <button
            onClick={() => handleHotModeToggle('all')}
            className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
              hotMode === 'all'
                ? 'bg-[#ff9f43]/30 border border-[#ff9f43]/50 text-slate-900 dark:text-white [data-theme="light"]:!text-slate-900'
                : 'bg-transparent border border-white/10 dark:border-white/10 [data-theme="light"]:border-slate-300 text-slate-900 dark:text-white/70 [data-theme="light"]:!text-slate-900 hover:border-white/30 dark:hover:border-white/30 [data-theme="light"]:hover:border-slate-400'
            }`}
          >
            全量Top 10
          </button>
        </div>
      </div>

      {hot.length > 0 ? (
        <>
          {hotMode === 'all' && (
            <div className="mb-4 text-sm font-mono text-white/70 dark:text-white/70 [data-theme='light']:text-slate-600">
              展示全量点赞榜前 10 名
            </div>
          )}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {hot.slice(0, hotDisplayCount).map((item, index) => (
              <PodcastCard key={item.id} item={item} rank={index + 1} />
            ))}
            {/* 加载更多时显示加载占位符 */}
            {loading.hot && hotDisplayCount < MAX_DISPLAY_COUNT && (
              <>
                {[...Array(Math.min(6, MAX_DISPLAY_COUNT - hotDisplayCount))].map((_, i) => (
                  <div key={`loading-${i}`} className="animate-pulse">
                    <div className="h-48 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-white/80 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg"></div>
                  </div>
                ))}
              </>
            )}
          </div>
          {hotMode === '30d' && ((hotDisplayCount < hot.length || hotHasMore) || hotDisplayCount > 9) && (
            <div className="mt-6 flex justify-center gap-3">
              {(hotDisplayCount < hot.length || hotHasMore) && hotDisplayCount < MAX_DISPLAY_COUNT && (
                <button
                  onClick={handleLoadMoreHot}
                  disabled={loading.hot}
                  className="px-6 py-2 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-card-surface backdrop-blur-sm border border-white/10 dark:border-white/10 [data-theme='light']:border-card-border hover:border-white/20 dark:hover:border-white/20 [data-theme='light']:hover:border-slate-300 hover:bg-zinc-900/60 dark:hover:bg-zinc-900/60 [data-theme='light']:hover:bg-slate-50 hover:shadow-lg hover:-translate-y-0.5 text-white dark:text-white [data-theme='light']:text-foreground rounded-lg transition-all font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.hot ? 'Loading...' : 'More'}
                </button>
              )}
              {hotDisplayCount > 9 && (
                <button
                  onClick={() => setHotDisplayCount(9)}
                  className="px-6 py-2 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-card-surface backdrop-blur-sm border border-white/10 dark:border-white/10 [data-theme='light']:border-card-border hover:border-white/20 dark:hover:border-white/20 [data-theme='light']:hover:border-slate-300 hover:bg-zinc-900/60 dark:hover:bg-zinc-900/60 [data-theme='light']:hover:bg-slate-50 hover:shadow-lg hover:-translate-y-0.5 text-white dark:text-white [data-theme='light']:text-foreground rounded-lg transition-all font-mono text-sm"
                >
                  Less
                </button>
              )}
            </div>
          )}
          {hotDisplayCount >= MAX_DISPLAY_COUNT && (
            <div className="mt-4 text-center text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-500 text-sm font-mono">
              已显示最多 {MAX_DISPLAY_COUNT} 个播客
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-500 [data-theme='light']:text-slate-500 py-12 font-mono text-sm border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg bg-zinc-900/20 dark:bg-zinc-900/20 [data-theme='light']:bg-slate-50">
          Loading…
        </div>
      )}
    </div>
  );

  const renderLikedSection = () => {
    if (!user) {
      return (
        <div className="text-center text-gray-500 dark:text-gray-400 [data-theme='light']:text-slate-700 py-12 font-mono text-sm border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg bg-zinc-900/20 dark:bg-zinc-900/20 [data-theme='light']:bg-white/50">
          登录后可以查看你点赞过的播客
        </div>
      );
    }

    if (likedLoading && likedItems.length === 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-48 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-white/80 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      );
    }

    // 修复：确保在没有点赞数据时显示空状态，而不是空卡片
    if (!likedLoading && likedItems.length === 0) {
      return (
        <div className="text-center text-gray-500 dark:text-gray-400 [data-theme='light']:text-slate-700 py-12 font-mono text-sm border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg bg-zinc-900/20 dark:bg-zinc-900/20 [data-theme='light']:bg-white/50">
          暂无点赞播客，快去点赞吧～
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <svg className="w-5 h-5 text-[#ff9f43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            />
          </svg>
          <h2 className="text-xl font-bold text-white dark:text-white [data-theme='light']:text-slate-900 font-mono">Liked</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-white/20 dark:from-white/20 [data-theme='light']:from-slate-300 to-transparent"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {likedItems.slice(0, likedDisplayCount).map((item: any, index: number) => {
            const podcast = normalizeLikedItem(item, index);
            return (
              <div key={podcast.id} className="relative h-full">
                <PodcastCard item={podcast} />
              </div>
            );
          })}
        </div>

        {((likedHasMore || likedDisplayCount < likedItems.length) || likedDisplayCount > 9) && (
          <div className="mt-6 flex justify-center gap-3">
            {(likedHasMore || likedDisplayCount < likedItems.length) && likedDisplayCount < MAX_DISPLAY_COUNT && (
              <button
                onClick={handleLoadMoreLiked}
                disabled={likedLoading}
                className="px-6 py-2 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-card-surface backdrop-blur-sm border border-white/10 dark:border-white/10 [data-theme='light']:border-card-border hover:border-white/20 dark:hover:border-white/20 [data-theme='light']:hover:border-slate-300 hover:bg-zinc-900/60 dark:hover:bg-zinc-900/60 [data-theme='light']:hover:bg-slate-50 hover:shadow-lg hover:-translate-y-0.5 text-white dark:text-white [data-theme='light']:text-foreground rounded-lg transition-all font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {likedLoading ? 'Loading...' : 'More'}
              </button>
            )}
            {likedDisplayCount > 9 && (
              <button
                onClick={() => setLikedDisplayCount(Math.min(9, likedItems.length))}
                className="px-6 py-2 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-card-surface backdrop-blur-sm border border-white/10 dark:border-white/10 [data-theme='light']:border-card-border hover:border-white/20 dark:hover:border-white/20 [data-theme='light']:hover:border-slate-300 hover:bg-zinc-900/60 dark:hover:bg-zinc-900/60 [data-theme='light']:hover:bg-slate-50 hover:shadow-lg hover:-translate-y-0.5 text-white dark:text-white [data-theme='light']:text-foreground rounded-lg transition-all font-mono text-sm"
              >
                Less
              </button>
            )}
          </div>
        )}
        {likedDisplayCount >= MAX_DISPLAY_COUNT && (
          <div className="mt-4 text-center text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 text-sm font-mono">
            已显示最多 {MAX_DISPLAY_COUNT} 个播客
          </div>
        )}
      </div>
    );
  };

  const loadHot = async (mode: '30d' | 'all' = '30d') => {
    const limit = mode === 'all' ? 10 : 15;
    const typeParam = mode === 'all' ? 'hot_all' : 'hot';
    setLoading(prev => ({ ...prev, hot: true }));
    try {
      const res = await fetch(`/api/public/list?type=${typeParam}&limit=${limit}&_t=${Date.now()}`);
      const data: ListResult = await res.json();
      const items = data.items || [];
      console.log('[首页] 最热播客数据:', items.length, '条', mode);
      setHot(items);
      setHotMode(mode);
      if (mode === 'all') {
        setHotDisplayCount(items.length);
        setHotHasMore(false);
      } else {
        const defaultCount = items.length === 0 ? 0 : Math.min(9, items.length);
        setHotDisplayCount(defaultCount);
        setHotHasMore(data.pagination?.hasNext || items.length >= limit);
      }
    } catch (error) {
      console.error('Failed to load hot:', error);
      setHot([]);
      if (mode === '30d') {
        setHotHasMore(false);
      }
    } finally {
      setLoading(prev => ({ ...prev, hot: false }));
    }
  };

  const handleLoadMoreHot = async () => {
    const currentCount = hotDisplayCount;
    const nextCount = Math.min(currentCount + 6, MAX_DISPLAY_COUNT); // 每次加载6个，但不超过上限
    
    // 如果已达到上限，不再加载
    if (nextCount >= MAX_DISPLAY_COUNT && currentCount >= MAX_DISPLAY_COUNT) {
      return;
    }
    
    // 如果需要的数量超过当前加载的数量，先加载更多数据
    if (hotMode === 'all') {
      return;
    }
    if (nextCount > hot.length) {
      try {
        // 优化：只加载需要的数据量，避免加载过多
        const loadCount = Math.min(nextCount, MAX_DISPLAY_COUNT);
        setLoading(prev => ({ ...prev, hot: true }));
        const res = await fetch(`/api/public/list?type=hot&limit=${loadCount}&_t=${Date.now()}`);
        const data: ListResult = await res.json();
        const newItems = data.items || [];
        
        // 保留已有数据，只更新为新数据（避免已显示的播客消失）
        // 如果新数据长度足够，直接使用新数据；否则合并数据
        if (newItems.length >= nextCount) {
          setHot(newItems);
        } else {
          // 如果新数据不够，保留已有数据，只追加新数据
          const existingIds = new Set(hot.map(item => item.id));
          const additionalItems = newItems.filter(item => !existingIds.has(item.id));
          setHot([...hot, ...additionalItems]);
        }
        
        setHotDisplayCount(nextCount);
        // 更新是否有更多数据（如果已达到上限，则不再显示More按钮）
        setHotHasMore(nextCount < MAX_DISPLAY_COUNT && (data.pagination?.hasNext || (newItems.length || 0) >= loadCount));
      } catch (error) {
        console.error('Failed to load more hot:', error);
        // 即使加载失败，也尝试显示更多（如果已有数据）
        if (hot.length >= nextCount) {
          setHotDisplayCount(nextCount);
        }
      } finally {
        setLoading(prev => ({ ...prev, hot: false }));
      }
    } else {
      // 如果已有足够数据，直接增加显示数量，不重新加载
      setHotDisplayCount(nextCount);
      // 如果已达到上限，隐藏More按钮
      if (nextCount >= MAX_DISPLAY_COUNT) {
        setHotHasMore(false);
      }
    }
  };



  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      console.log('Starting search for:', searchQuery.trim());
      const url = `/api/public/search?q=${encodeURIComponent(searchQuery.trim())}`;
      console.log('Search URL:', url);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Search response status:', res.status);
      console.log('Search response headers:', res.headers);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const result: SearchResult = await res.json();
      console.log('Search API response:', result);
      
      // 确保返回的数据结构正确
      if (result && typeof result === 'object') {
        const searchResult = {
          hits: result.hits || [],
          notFound: result.notFound || false
        };
        console.log('Setting search result:', searchResult);
        setSearchResult(searchResult);
      } else {
        console.log('Invalid result, setting notFound=true');
        setSearchResult({ hits: [], notFound: true });
      }
    } catch (error) {
      console.error('Search failed:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      setSearchResult({ hits: [], notFound: true });
    } finally {
      setIsSearching(false);
    }
  };

  const handleProcessPodcast = async (url: string) => {
    // 检查用户权限
    if (!user) {
      toast.error('请先登录', '请先登录后再处理播客', {
        action: {
          label: '去登录',
          onClick: () => window.location.href = '/login'
        }
      });
      return;
    }

    // 检查是否为 Reader，如果是则弹出升级提示
    if (user.role === 'READER') {
      setShowUpgradeModal(true);
      return;
    }

    // 检查是否已经在处理这个URL
    const existing = localStorage.getItem('processingPodcasts');
    const items = existing ? JSON.parse(existing) : [];
    const alreadyProcessing = items.some((item: any) => 
      item.url === url && item.status === 'processing'
    );
    
    if (alreadyProcessing) {
      toast.warning('已在处理中', '这个播客链接已经在处理队列中了');
      return;
    }

    // 创建处理项目
    const processingId = `processing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processingItem = {
      id: processingId,
      url: url,
      status: 'processing' as const,
      progress: 0,
      startTime: Date.now(),
      taskId: null as string | null
    };

    // 保存到localStorage
    items.push(processingItem);
    localStorage.setItem('processingPodcasts', JSON.stringify(items));

    // 触发storage事件，通知Header组件更新
    window.dispatchEvent(new Event('storage'));

    try {
      console.log('🚀 开始提交播客处理请求:', url);
      
      // 使用异步处理API，添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      let res: Response;
      try {
        console.log('📡 发送API请求到 /api/process-audio-async');
        res = await fetch('/api/process-audio-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log('✅ API请求完成，状态码:', res.status, res.statusText);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error('❌ API请求失败:', {
          name: fetchError.name,
          message: errorMessage,
          stack: fetchError.stack
        });
        
        // 详细诊断网络错误
        if (fetchError.name === 'AbortError' || errorMessage.includes('aborted')) {
          throw new Error('请求超时：服务器响应时间超过30秒，请检查网络连接或稍后重试');
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          throw new Error('网络连接失败：无法连接到服务器，请检查网络连接或确认服务器是否正常运行');
        } else if (errorMessage.includes('CORS')) {
          throw new Error('跨域请求失败：请检查服务器CORS配置');
        } else {
          throw new Error(`网络请求失败: ${errorMessage}`);
        }
      }

      if (!res.ok) {
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch (e) {
          // 如果响应不是JSON，尝试读取文本
          const text = await res.text().catch(() => '');
          errorData = { error: text || `HTTP ${res.status} ${res.statusText}` };
        }
        
        const errorMessage = errorData.error || `服务器错误 (${res.status})`;
        
        // 根据状态码提供更详细的错误信息
        if (res.status === 401) {
          throw new Error('请先登录后再处理播客');
        } else if (res.status === 429) {
          throw new Error('今日处理额度已用完，请明天再试');
        } else if (res.status === 500) {
          throw new Error(`服务器内部错误: ${errorMessage}`);
        } else if (res.status === 503) {
          throw new Error('服务暂时不可用，请稍后重试');
        } else {
          throw new Error(errorMessage);
        }
      }

      let result: any;
      try {
        result = await res.json();
        console.log('📦 API响应数据:', result);
      } catch (jsonError) {
        console.error('❌ JSON解析失败:', jsonError);
        const text = await res.text().catch(() => '');
        console.error('响应文本:', text.substring(0, 500));
        throw new Error(`服务器响应格式错误: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
      }
      
      // 验证响应数据
      if (!result) {
        console.error('❌ API响应为空');
        throw new Error('服务器返回了空响应');
      }
      
      if (!result.success) {
        console.error('❌ API返回失败:', result);
        throw new Error(result?.error || result?.message || '服务器返回了失败响应');
      }
      
      if (!result.taskId) {
        console.error('❌ API响应缺少taskId:', result);
        throw new Error('服务器响应格式错误：缺少taskId');
      }
      
      console.log('✅ 任务提交成功，taskId:', result.taskId);
      
      // 更新处理项目，添加taskId
      const updatedItems = items.map((item: any) => 
        item.id === processingId 
          ? { 
              ...item, 
              taskId: result.taskId,
              status: 'processing' // 保持processing状态，等待后台处理
            }
          : item
      );
      localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
      window.dispatchEvent(new Event('storage'));
      
      // 显示成功消息
      toast.success('任务已提交', '播客处理任务已提交，正在后台处理中...');
      
      // 延迟2秒后开始轮询，给任务一些时间开始处理
      // 这样可以避免任务刚提交时立即轮询可能遇到的网络错误
      setTimeout(() => {
        pollTaskStatus(result.taskId, processingId);
      }, 2000);

    } catch (error) {
      console.error('Processing failed:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // 更新处理状态为失败
      const errorMessage = error instanceof Error ? error.message : String(error);
      const updatedItems = items.map((item: any) => 
        item.id === processingId 
          ? { ...item, status: 'failed', progress: 0, error: errorMessage }
          : item
      );
      localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
      window.dispatchEvent(new Event('storage'));
      
      // 显示友好的错误信息，根据错误类型提供不同的提示
      if (errorMessage.includes('请先登录')) {
        toast.error('请先登录', '请先登录后再处理播客', {
          action: {
            label: '去登录',
            onClick: () => window.location.href = '/login'
          }
        });
      } else if (errorMessage.includes('额度已用完')) {
        toast.warning('今日额度已用完', '今日处理额度已用完，请明天再试');
      } else if (errorMessage.includes('请求超时') || errorMessage.includes('超时')) {
        toast.error('请求超时', errorMessage, {
          action: {
            label: '重试',
            onClick: () => handleProcessPodcast(url)
          }
        });
      } else if (errorMessage.includes('网络连接失败') || errorMessage.includes('无法连接到服务器')) {
        toast.error('网络连接失败', errorMessage, {
          action: {
            label: '重试',
            onClick: () => handleProcessPodcast(url)
          }
        });
      } else if (errorMessage.includes('服务器内部错误')) {
        toast.error('服务器错误', errorMessage, {
          action: {
            label: '联系支持',
            onClick: () => alert('请联系支持：maoweihao@example.com')
          }
        });
      } else {
        toast.error('处理失败', errorMessage || '未知错误，请稍后重试', {
          action: {
            label: '重试',
            onClick: () => handleProcessPodcast(url)
          }
        });
      }
    }
  };

  // 轮询任务状态
  const pollTaskStatus = async (taskId: string, processingId: string) => {
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5; // 增加到5次，给更多重试机会
    let pollCount = 0;
    let lastSuccessfulPoll = Date.now(); // 记录最后一次成功轮询的时间
    let failedPollCount = 0; // 用于跟踪FAILED状态的轮询次数
    
    console.log(`🔄 开始轮询任务状态: ${taskId}`);
    
    // 轮询间隔：10秒
    const POLL_INTERVAL_MS = 10000;
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      try {
        console.log(`📡 轮询任务状态 (第${pollCount}次): ${taskId}`);
        // 增加超时时间到30秒，因为长时间音频处理可能需要更长时间
        // 特别是对于22+分段的音频，服务器端处理时间可能较长
        const res = await fetch(`/api/task-status?taskId=${taskId}`, {
          signal: AbortSignal.timeout(30000) // 30秒超时（从10秒增加到30秒）
        });
        
        if (!res.ok) {
          consecutiveErrors++;
          console.warn(`⚠️ 任务状态查询失败 (${consecutiveErrors}/${maxConsecutiveErrors}): HTTP ${res.status}`);
          
          // 只有在连续失败且距离最后一次成功轮询超过30秒时，才考虑标记为失败
          // 这样可以避免任务刚提交时立即轮询可能遇到的网络错误
          const timeSinceLastSuccess = Date.now() - lastSuccessfulPoll;
          if (consecutiveErrors >= maxConsecutiveErrors && timeSinceLastSuccess > 30000) {
            clearInterval(pollInterval);
            
            // 在标记为失败之前，先尝试通过URL搜索播客，看看是否已经成功保存
            try {
              const existing = localStorage.getItem('processingPodcasts');
              const items = existing ? JSON.parse(existing) : [];
              const currentItem = items.find((item: any) => item.id === processingId);
              
              if (currentItem?.url) {
                console.log('🔍 HTTP错误后，尝试通过URL搜索播客:', currentItem.url);
                const searchRes = await fetch(`/api/public/search?q=${encodeURIComponent(currentItem.url)}`);
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  if (searchData.results && searchData.results.length > 0) {
                    const podcast = searchData.results[0];
                    console.log('✅ 发现播客已成功保存:', podcast.id);
                    
                    // 更新处理状态为完成
                    const updatedItems = items.map((item: any) => 
                      item.id === processingId 
                        ? { 
                            ...item, 
                            status: 'completed', 
                            progress: 100, 
                            title: podcast.title,
                            error: null,
                            completedAt: Date.now()
                          }
                        : item
                    );
                    localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                    window.dispatchEvent(new Event('storage'));
                    
                    // 刷新首页数据
                    loadLatest();
                    loadHot();
                    
                    // 显示右上角通知，不自动跳转
                    toast.success(
                      '处理完成',
                      `${podcast.title || '播客'} 已处理完成，点击查看`,
                      {
                        duration: 8000,
                        action: {
                          label: '查看',
                          onClick: () => {
                            window.location.href = `/podcast/${podcast.id}`;
                          }
                        }
                      }
                    );
                    return;
                  }
                }
              }
            } catch (searchError) {
              console.warn('搜索播客失败，继续标记为失败:', searchError);
            }
            
            // 更新处理状态为失败
            const existing = localStorage.getItem('processingPodcasts');
            const items = existing ? JSON.parse(existing) : [];
            const updatedItems = items.map((item: any) => 
              item.id === processingId 
                ? { 
                    ...item, 
                    status: 'failed', 
                    progress: 0, 
                    error: `无法获取任务状态 (HTTP ${res.status})，请稍后重试或检查任务是否正在处理中`
                  }
                : item
            );
            localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
            window.dispatchEvent(new Event('storage'));
            
            toast.error('处理失败', `无法获取任务状态，请稍后重试或检查任务是否正在处理中`);
            return;
          }
          
          // 等待下次重试
          return;
        }
        
        // 请求成功，更新最后成功时间并重置错误计数
        lastSuccessfulPoll = Date.now();
        if (consecutiveErrors > 0) {
          console.log(`✅ 任务状态查询恢复成功，重置错误计数`);
          consecutiveErrors = 0;
        }
        
        const taskStatus = await res.json();
        console.log(`📦 任务状态响应:`, {
          status: taskStatus.status,
          hasResult: !!taskStatus.result,
          error: taskStatus.error
        });
        
        // 如果任务状态为READY，说明处理成功
        if (taskStatus.status === 'READY') {
          clearInterval(pollInterval);
          
          // 更新处理状态为完成
          const existing = localStorage.getItem('processingPodcasts');
          const items = existing ? JSON.parse(existing) : [];
          const updatedItems = items.map((item: any) => 
            item.id === processingId 
              ? { 
                  ...item, 
                  status: 'completed', 
                  progress: 100, 
                  title: taskStatus.result?.title,
                  error: null, // 清除之前的错误信息
                  completedAt: Date.now()
                }
              : item
          );
          localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
          window.dispatchEvent(new Event('storage'));
          
          // 刷新首页数据
          loadLatest();
          loadHot();
          
          // 显示右上角通知，不自动跳转
          if (taskStatus.result?.id) {
            const podcastTitle = taskStatus.result?.title || '播客';
            toast.success(
              '处理完成',
              `${podcastTitle} 已处理完成，点击查看`,
              {
                duration: 8000, // 8秒后自动消失
                action: {
                  label: '查看',
                  onClick: () => {
                    window.location.href = `/podcast/${taskStatus.result.id}`;
                  }
                }
              }
            );
          } else {
            toast.success('处理完成', '播客已处理完成，请刷新页面查看');
          }
          
        } else if (taskStatus.status === 'FAILED') {
          // 连续 FAILED 轮询的上限，防止无限循环
          const MAX_FAILED_POLLS = 8; // 超过8次直接判失败
          const MAX_FAILED_DURATION = 2 * 60 * 1000; // 或超过2分钟

          failedPollCount++;
          
          const taskStartTime = taskStatus.startedAt ? new Date(taskStatus.startedAt).getTime() : Date.now();
          const timeSinceStart = Date.now() - taskStartTime;
          const shouldMarkAsFailed = failedPollCount >= MAX_FAILED_POLLS || timeSinceStart > MAX_FAILED_DURATION;
          
          if (!shouldMarkAsFailed) {
            console.log(`⚠️ 检测到FAILED状态，但继续轮询确认（${failedPollCount}/${MAX_FAILED_POLLS}次，已运行${Math.round(timeSinceStart/1000)}秒）`);
            return; // 继续轮询
          }
          
          clearInterval(pollInterval);
          
          // 在标记为失败之前，先尝试通过URL搜索播客，看看是否已经成功保存
          try {
            const existing = localStorage.getItem('processingPodcasts');
            const items = existing ? JSON.parse(existing) : [];
            const currentItem = items.find((item: any) => item.id === processingId);
            
            if (currentItem?.url) {
              console.log('🔍 任务失败后，尝试通过URL搜索播客:', currentItem.url);
              const searchRes = await fetch(`/api/public/search?q=${encodeURIComponent(currentItem.url)}`);
              if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.results && searchData.results.length > 0) {
                  const podcast = searchData.results[0];
                  console.log('✅ 发现播客已成功保存:', podcast.id);
                  
                  // 更新处理状态为完成
                  const updatedItems = items.map((item: any) => 
                    item.id === processingId 
                      ? { 
                          ...item, 
                          status: 'completed', 
                          progress: 100, 
                          title: podcast.title,
                          error: null,
                          completedAt: Date.now()
                        }
                      : item
                  );
                  localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                  window.dispatchEvent(new Event('storage'));
                  
                  // 刷新首页数据
                  loadLatest();
                  loadHot();
                  
                  // 显示右上角通知
                  toast.success(
                    '处理完成',
                    `${podcast.title || '播客'} 已处理完成，点击查看`,
                    {
                      duration: 8000,
                      action: {
                        label: '查看',
                        onClick: () => {
                          window.location.href = `/podcast/${podcast.id}`;
                        }
                      }
                    }
                  );
                  return;
                }
              }
            }
          } catch (searchError) {
            console.warn('搜索播客失败，继续标记为失败:', searchError);
          }
          
          // 判断是否是"立刻失败"（快速失败）
          const isQuickFailure = taskStatus.startedAt && taskStatus.completedAt && 
                               (new Date(taskStatus.completedAt).getTime() - new Date(taskStatus.startedAt).getTime()) < 5000; // 5秒内失败
          
          // 判断是否是网络相关错误
          let errorMessage = taskStatus.error || '播客处理失败';
          
          // 清理错误信息，移除可能的残留变量引用或技术细节
          if (errorMessage.includes('is not defined') || errorMessage.includes('未定义')) {
            // 如果是未定义变量错误，尝试提取更具体的错误信息
            if (errorMessage.includes('allowNullUserId')) {
              errorMessage = '数据库保存失败: 处理过程中出现配置错误，但播客可能已成功保存';
            } else {
              errorMessage = '处理失败: 代码执行错误，但播客可能已成功保存，请刷新页面查看';
            }
          }
          
          const isNetworkError = errorMessage.includes('fetch failed') || 
                                 errorMessage.includes('网络请求失败') ||
                                 errorMessage.includes('ECONNREFUSED') ||
                                 errorMessage.includes('ETIMEDOUT') ||
                                 errorMessage.includes('ENOTFOUND') ||
                                 errorMessage.includes('DNS') ||
                                 errorMessage.includes('网络连接');
          
          // 判断是否是数据库相关错误
          const isDatabaseError = errorMessage.includes('数据库') || 
                                  errorMessage.includes('Prisma') ||
                                  errorMessage.includes('保存失败') ||
                                  errorMessage.includes('保存播客');
          
          // 更新处理状态为失败
          const existing = localStorage.getItem('processingPodcasts');
          const items = existing ? JSON.parse(existing) : [];
          const updatedItems = items.map((item: any) => 
            item.id === processingId 
              ? { 
                  ...item, 
                  status: 'failed', 
                  progress: 0, 
                  error: errorMessage
                }
              : item
          );
          localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
          window.dispatchEvent(new Event('storage'));
          
          // 如果是快速失败且是网络错误，显示友好提示
          if (isQuickFailure && isNetworkError) {
            toast.error(
              '处理失败', 
              '当前服务器网络不稳定，可能是临时性网络问题。请稍后再试一次，通常第二次就能成功。',
              {
                duration: 8000, // 8秒后自动消失
                action: {
                  label: '重试',
                  onClick: () => {
                    // 从localStorage中获取失败的任务URL
                    const currentItems = JSON.parse(localStorage.getItem('processingPodcasts') || '[]');
                    const failedItem = currentItems.find((item: any) => item.id === processingId);
                    
                    // 从localStorage中移除失败的任务
                    const filteredItems = currentItems.filter((item: any) => item.id !== processingId);
                    localStorage.setItem('processingPodcasts', JSON.stringify(filteredItems));
                    window.dispatchEvent(new Event('storage'));
                    
                    // 重新提交处理请求
                    if (failedItem?.url) {
                      handleProcessPodcast(failedItem.url);
                    }
                  }
                }
              }
            );
          } else if (isDatabaseError && errorMessage.includes('可能已成功保存')) {
            // 如果是数据库错误但可能已成功保存，显示特殊提示
            toast.warning(
              '处理状态异常', 
              '后端报告处理失败，但播客可能已成功保存。请刷新页面查看，或通过搜索功能查找该播客。',
              {
                duration: 10000, // 10秒后自动消失
                action: {
                  label: '刷新页面',
                  onClick: () => {
                    window.location.reload();
                  }
                }
              }
            );
          } else {
            // 其他情况显示普通错误提示
            toast.error('处理失败', errorMessage);
          }
        }
        
      } catch (error) {
        consecutiveErrors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : 'Unknown';
        
        console.error(`❌ 轮询任务状态失败 (${consecutiveErrors}/${maxConsecutiveErrors}):`, {
          name: errorName,
          message: errorMessage,
          taskId
        });
        
        // 如果是超时错误，给更多重试机会（特别是对于长时间音频处理）
        // 超时错误可能是网络问题或服务器处理时间过长，不应该立即标记为失败
        if (errorName === 'AbortError' || errorName === 'TimeoutError' || errorMessage.includes('timeout') || errorMessage.includes('超时') || errorMessage.includes('timed out')) {
          console.warn('⏱️ 请求超时，继续重试...（这可能是网络问题或服务器处理时间较长）');
          // 对于超时错误，给更多重试机会（从2倍增加到3倍）
          if (consecutiveErrors >= maxConsecutiveErrors * 3) {
            clearInterval(pollInterval);
            
            // 在标记为失败之前，先尝试通过URL搜索播客，看看是否已经成功保存
            try {
              const existing = localStorage.getItem('processingPodcasts');
              const items = existing ? JSON.parse(existing) : [];
              const currentItem = items.find((item: any) => item.id === processingId);
              
              if (currentItem?.url) {
                console.log('🔍 超时后，尝试通过URL搜索播客:', currentItem.url);
                const searchRes = await fetch(`/api/public/search?q=${encodeURIComponent(currentItem.url)}`);
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  if (searchData.results && searchData.results.length > 0) {
                    const podcast = searchData.results[0];
                    console.log('✅ 发现播客已成功保存:', podcast.id);
                    
                    // 更新处理状态为完成
                    const updatedItems = items.map((item: any) => 
                      item.id === processingId 
                        ? { 
                            ...item, 
                            status: 'completed', 
                            progress: 100, 
                            title: podcast.title,
                            error: null,
                            completedAt: Date.now()
                          }
                        : item
                    );
                    localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                    window.dispatchEvent(new Event('storage'));
                    
                    // 刷新首页数据
                    loadLatest();
                    loadHot();
                    
                    // 显示右上角通知，不自动跳转
                    toast.success(
                      '处理完成',
                      `${podcast.title || '播客'} 已处理完成，点击查看`,
                      {
                        duration: 8000,
                        action: {
                          label: '查看',
                          onClick: () => {
                            window.location.href = `/podcast/${podcast.id}`;
                          }
                        }
                      }
                    );
                    return;
                  }
                }
              }
            } catch (searchError) {
              console.warn('搜索播客失败，继续标记为失败:', searchError);
            }
            
            const existing = localStorage.getItem('processingPodcasts');
            const items = existing ? JSON.parse(existing) : [];
            const updatedItems = items.map((item: any) => 
              item.id === processingId 
                ? { 
                    ...item, 
                    status: 'failed', 
                    progress: 0, 
                    error: `请求超时：无法获取任务状态，任务可能仍在处理中，请稍后刷新页面查看`
                  }
                : item
            );
            localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
            window.dispatchEvent(new Event('storage'));
            toast.error('处理失败', `请求超时：无法获取任务状态，任务可能仍在处理中，请稍后刷新页面查看`);
            return;
          }
          return;
        }
        
        // 如果是网络错误，给更多重试机会
        if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
          console.warn('🌐 网络错误，继续重试...');
          if (consecutiveErrors >= maxConsecutiveErrors * 2) {
            clearInterval(pollInterval);
            
            // 在标记为失败之前，先尝试通过URL搜索播客，看看是否已经成功保存
            try {
              const existing = localStorage.getItem('processingPodcasts');
              const items = existing ? JSON.parse(existing) : [];
              const currentItem = items.find((item: any) => item.id === processingId);
              
              if (currentItem?.url) {
                console.log('🔍 网络错误后，尝试通过URL搜索播客:', currentItem.url);
                const searchRes = await fetch(`/api/public/search?q=${encodeURIComponent(currentItem.url)}`);
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  if (searchData.results && searchData.results.length > 0) {
                    const podcast = searchData.results[0];
                    console.log('✅ 发现播客已成功保存:', podcast.id);
                    
                    // 更新处理状态为完成
                    const updatedItems = items.map((item: any) => 
                      item.id === processingId 
                        ? { 
                            ...item, 
                            status: 'completed', 
                            progress: 100, 
                            title: podcast.title,
                            error: null,
                            completedAt: Date.now()
                          }
                        : item
                    );
                    localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                    window.dispatchEvent(new Event('storage'));
                    
                    // 刷新首页数据
                    loadLatest();
                    loadHot();
                    
                    // 显示右上角通知，不自动跳转
                    toast.success(
                      '处理完成',
                      `${podcast.title || '播客'} 已处理完成，点击查看`,
                      {
                        duration: 8000,
                        action: {
                          label: '查看',
                          onClick: () => {
                            window.location.href = `/podcast/${podcast.id}`;
                          }
                        }
                      }
                    );
                    return;
                  }
                }
              }
            } catch (searchError) {
              console.warn('搜索播客失败，继续标记为失败:', searchError);
            }
            
            // 如果搜索失败或未找到，标记为失败
            const existing = localStorage.getItem('processingPodcasts');
            const items = existing ? JSON.parse(existing) : [];
            const updatedItems = items.map((item: any) => 
              item.id === processingId 
                ? { 
                    ...item, 
                    status: 'failed', 
                    progress: 0, 
                    error: `网络错误：无法连接到服务器，请检查网络连接。如果任务已完成，请刷新页面查看。`
                  }
                : item
            );
            localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
            window.dispatchEvent(new Event('storage'));
            toast.error('处理失败', `网络错误：无法连接到服务器，请检查网络连接。如果任务已完成，请刷新页面查看。`);
            return;
          }
          return;
        }
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          clearInterval(pollInterval);
          
          // 更新处理状态为失败
          const existing = localStorage.getItem('processingPodcasts');
          const items = existing ? JSON.parse(existing) : [];
          const updatedItems = items.map((item: any) => 
            item.id === processingId 
              ? { 
                  ...item, 
                  status: 'failed', 
                  progress: 0, 
                  error: errorMessage || '获取任务状态失败'
                }
              : item
          );
          localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
          window.dispatchEvent(new Event('storage'));
          
          toast.error('处理失败', errorMessage || '获取任务状态失败，请稍后重试');
        }
      }
    }, POLL_INTERVAL_MS); // 每10秒轮询一次
    
    // 设置超时，避免无限轮询
    setTimeout(() => {
      clearInterval(pollInterval);
      
      // 超时后检查任务状态
      const existing = localStorage.getItem('processingPodcasts');
      const items = existing ? JSON.parse(existing) : [];
      const taskItem = items.find((item: any) => item.id === processingId);
      
      if (taskItem && taskItem.status === 'processing') {
        // 任务仍然在处理中，标记为超时
        const updatedItems = items.map((item: any) => 
          item.id === processingId 
            ? { 
                ...item, 
                status: 'failed', 
                progress: 0, 
                error: '处理超时，请重试'
              }
            : item
        );
        localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
        window.dispatchEvent(new Event('storage'));
        
        toast.error('处理超时', '播客处理超时，请稍后重试');
      }
    }, 3 * 60 * 60 * 1000); // 3小时超时，支持长时间播客处理
  };


  return (
    <div className="min-h-screen bg-black dark:bg-black [data-theme='light']:bg-[#f5f4f1] relative">
      {/* 动态点阵网格背景 - 根据主题显示不同颜色的点阵 */}
      <AnimatedDotGrid 
        dotSize={1.5}
        spacing={24}
        activeDotRatio={0.08}
        minCycleDuration={3000}
        maxCycleDuration={8000}
      />
      {/* 主要内容区域 */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Hero Section - 搜索区域 */}
        <div className="relative w-full mt-16 px-6 overflow-visible mb-10">
          {/* === Aurora Glow Backgrounds === */}
          {/* Left Glow: White/Silver (Input) */}
          <div className="hidden md:block absolute top-3/5 -translate-y-1/2 left-0 w-[300px] h-[300px] bg-white rounded-full blur-[120px] opacity-24 animate-pulse-slow pointer-events-none -z-10" style={{ transform: 'translate(-30%, -50%)' }}></div>
          
          {/* Right Glow: Orange (Output) - with fade-in and delay, reduced opacity for smoother appearance */}
          <div className="hidden md:block absolute top-3/5 -translate-y-1/2 right-0 w-[300px] h-[300px] bg-[#ff6a00] rounded-full blur-[120px] opacity-0 pointer-events-none -z-10 animate-fade-in-glow animate-pulse-slow" style={{ transform: 'translate(30%, -50%)', animationDelay: '1.5s, 3.5s', animationFillMode: 'forwards' }}></div>

          {/* === Main Content === */}
          <div className="relative mx-auto max-w-4xl text-center z-10">
            {/* Typography: "Podcast to Insight" */}
            <h1 className="mb-10 text-5xl font-bold tracking-tight sm:text-7xl flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <span className="text-zinc-100 dark:text-zinc-100 [data-theme='light']:!text-foreground tracking-tighter">Podcast</span>
              <span className="font-serif italic text-3xl sm:text-4xl text-zinc-600 dark:text-zinc-600 [data-theme='light']:!text-zinc-700 font-light">to</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffd48f] via-[#ff9f43] to-[#ff6a00]">
                Insight
              </span>
            </h1>
            
            {/* Search Bar */}
            <div className="relative z-10 group flex items-center rounded-xl bg-black/60 dark:bg-black/60 [data-theme='light']:bg-[#faf9f6]/90 p-2 ring-1 ring-white/10 dark:ring-white/10 [data-theme='light']:ring-slate-200 transition-all focus-within:ring-[#ff8c32]/60 focus-within:shadow-[0_0_60px_-15px_rgba(255,140,50,0.4)] backdrop-blur-2xl">
              <div className="flex h-12 w-12 items-center justify-center text-zinc-500 dark:text-zinc-500 [data-theme='light']:text-slate-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Paste Podcast Url or Title here... (Xiaoyuzhou & Apple Podcasts)"
                className="flex-1 bg-transparent px-2 py-3 text-lg text-white dark:text-white [data-theme='light']:text-foreground placeholder-zinc-600 dark:placeholder-zinc-600 [data-theme='light']:placeholder-slate-400 outline-none font-light"
                disabled={isSearching}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-sm font-bold text-black transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isSearching ? 'Processing...' : 'Analyze'}</span>
                {!isSearching && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                )}
              </button>
            </div>
            
            {/* Bottom Subtle Connector Glow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[100px] -z-20 opacity-30 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/40 via-transparent to-transparent blur-3xl"></div>
            </div>
          </div>

          {false && catalogSummary && (
            <div className="absolute bottom-[-18px] right-[10%] text-right font-mono text-[12px] tracking-[0.2em] text-white/45">
              <div className="uppercase">total catalog</div>
              <div className="text-white/75 tracking-normal font-semibold text-[15px]">
                {(catalogSummary?.totalPodcasts ?? 0).toLocaleString()} podcasts · {(catalogSummary?.totalMinutes ?? 0).toLocaleString()} min
              </div>
            </div>
          )}


          {/* 搜索结果 */}
          {searchResult && (
            <div className="mt-6">
              {searchResult.hits && searchResult.hits.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-bold text-white dark:text-white [data-theme='light']:text-foreground text-sm mb-3 font-mono">搜索结果：</h3>
                  {searchResult.hits.map((item) => (
                    <Link
                      key={item.id}
                      href={`/podcast/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-card-surface backdrop-blur-sm rounded-lg border border-white/10 dark:border-white/10 [data-theme='light']:border-card-border hover:border-white/20 dark:hover:border-white/20 [data-theme='light']:hover:border-slate-300 hover:bg-zinc-900/60 dark:hover:bg-zinc-900/60 [data-theme='light']:hover:bg-slate-50 transition-all"
                    >
                      <h4 className="font-semibold text-white dark:text-white [data-theme='light']:text-foreground text-sm mb-2">{item.title}</h4>
                      <div className="text-xs text-gray-400 mt-1 space-x-2 font-mono">
                        {item.author && <span>{item.author}</span>}
                        {item.publishedAt && (
                          <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                        )}
                        {!item.author && !item.publishedAt && <span>未知时间</span>}
                      </div>
                      {item.summary && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              ) : searchResult.notFound ? (
                <div className="py-8">
                  {user ? (
                    <button
                      onClick={() => handleProcessPodcast(searchQuery)}
                      className="group relative mx-auto flex w-full max-w-4xl items-center gap-5 rounded-2xl border border-white/15 bg-gradient-to-r from-white/5 via-white/0 to-white/5 px-6 py-5 text-left shadow-[0_25px_60px_-30px_rgba(255,140,50,0.8)] transition-all hover:border-white/30 hover:shadow-[0_35px_80px_-45px_rgba(255,140,50,0.85)]"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl">
                        ✨
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-semibold text-white dark:text-white [data-theme='light']:text-foreground">
                          You&rsquo;re the first to explore this podcast
                        </p>
                        <p className="text-sm text-zinc-400 dark:text-zinc-400 [data-theme='light']:text-slate-600">
                          Click to unlock the first Insight and share it with everyone.
                        </p>
                      </div>
                      <div className="ml-4 inline-flex items-center gap-2 rounded-full border border-orange-300/30 dark:border-orange-400/30 [data-theme='light']:border-orange-400/40 bg-gradient-to-r from-[#ffe0a3]/40 via-[#ff9f43]/40 to-[#ff6a00]/40 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_25px_-15px_rgba(255,122,0,0.55)] transition group-hover:border-white/50 group-hover:shadow-[0_14px_30px_-20px_rgba(255,122,0,0.65)] group-hover:from-[#ffd48f]/50 group-hover:to-[#ff6a00]/50">
                        Generate Insight
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M3 8h10M9 4l4 4-4 4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </button>
                  ) : (
                    <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                      <div className="text-gray-300 text-sm">
                        <p className="font-medium mb-2">请联系 阿茅（Wechat：njumwh）获取邀请码</p>
                        <p className="text-gray-500">注册并登录，从而获得播客转录权限</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

        </div>

        {/* 播客网格区域 Tabs */}
        <div className="space-y-10">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3 flex-wrap">
              {tabOptions.map((tab) => {
                const isActive = activeTab === tab.id;
                const disabled = tab.requiresAuth && !user;
                return (
                  <button
                    key={tab.id}
                    onClick={() => !disabled && setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-mono transition-all ${
                      isActive ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-white'
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-base sm:text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="ml-auto text-xs font-mono tabular-nums tracking-wider text-zinc-500 flex items-center gap-2">
              <span>{summaryDisplay.podcasts.toLocaleString()} PODS</span>
              <span className="text-white/30">|</span>
              <span>{summaryDisplay.hours.toLocaleString()} HRS</span>
            </div>
          </div>

          <div className="mt-6">
            {activeTab === 'new' && renderNewSection()}
            {activeTab === 'top' && renderTopSection()}
            {activeTab === 'liked' && renderLikedSection()}
          </div>
        </div>

      </main>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
