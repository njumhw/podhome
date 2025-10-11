"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';

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
  const [user, setUser] = useState<any>(null);

  const [latest, setLatest] = useState<PodcastItem[]>([]);
  const [hot, setHot] = useState<PodcastItem[]>([]);
  const [allPodcasts, setAllPodcasts] = useState<PodcastItem[]>([]);
  const [showAllPodcasts, setShowAllPodcasts] = useState(false);
  const [allPodcastsPage, setAllPodcastsPage] = useState(1);
  const [allPodcastsTotal, setAllPodcastsTotal] = useState(0);
  const [loading, setLoading] = useState({ latest: false, hot: false, allPodcasts: false });

  // 加载首页数据
  useEffect(() => {
    loadLatest();
    loadHot();
    
    // 检查用户登录状态
    const checkUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
      }
    };
    
    checkUser();
  }, []);

  const loadLatest = async () => {
    setLoading(prev => ({ ...prev, latest: true }));
    try {
      const res = await fetch('/api/public/list?type=latest&limit=6');
      const data: ListResult = await res.json();
      setLatest(data.items || []);
    } catch (error) {
      console.error('Failed to load latest:', error);
      setLatest([]);
    } finally {
      setLoading(prev => ({ ...prev, latest: false }));
    }
  };

  const loadHot = async () => {
    setLoading(prev => ({ ...prev, hot: true }));
    try {
      const res = await fetch('/api/public/list?type=hot&limit=6');
      const data: ListResult = await res.json();
      setHot(data.items || []);
    } catch (error) {
      console.error('Failed to load hot:', error);
      setHot([]);
    } finally {
      setLoading(prev => ({ ...prev, hot: false }));
    }
  };


  const loadAllPodcasts = async (page = 1) => {
    setLoading(prev => ({ ...prev, allPodcasts: true }));
    try {
      const res = await fetch(`/api/public/list?type=latest&limit=10&page=${page}`);
      if (res.ok) {
        const data: ListResult = await res.json();
        setAllPodcasts(data.items || []);
        setAllPodcastsTotal(data.pagination.total);
        setAllPodcastsPage(page);
      }
    } catch (error) {
      console.error('Failed to load all podcasts:', error);
      setAllPodcasts([]);
    } finally {
      setLoading(prev => ({ ...prev, allPodcasts: false }));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/public/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const result: SearchResult = await res.json();
      
      console.log('Search API response:', result); // 调试信息
      
      // 确保返回的数据结构正确
      if (result && typeof result === 'object') {
        const searchResult = {
          hits: result.hits || [],
          notFound: result.notFound || false
        };
        console.log('Setting search result:', searchResult); // 调试信息
        setSearchResult(searchResult);
      } else {
        console.log('Invalid result, setting notFound=true'); // 调试信息
        setSearchResult({ hits: [], notFound: true });
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResult({ hits: [], notFound: true });
    } finally {
      setIsSearching(false);
    }
  };

  const handleProcessPodcast = async (url: string) => {
    setIsProcessing(true);

    // 创建处理项目
    const processingId = `processing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processingItem = {
      id: processingId,
      url: url,
      status: 'processing' as const,
      progress: 0,
      startTime: Date.now()
    };

    // 保存到localStorage
    const existing = localStorage.getItem('processingPodcasts');
    const items = existing ? JSON.parse(existing) : [];
    items.push(processingItem);
    localStorage.setItem('processingPodcasts', JSON.stringify(items));

    // 触发storage事件，通知Header组件更新
    window.dispatchEvent(new Event('storage'));

    try {
      const res = await fetch('/api/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error || '处理失败';
        throw new Error(errorMessage);
      }

      const result = await res.json();
      
      // 更新处理状态为完成
      const updatedItems = items.map((item: any) => 
        item.id === processingId 
          ? { ...item, status: 'completed', progress: 100, title: result.title }
          : item
      );
      localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
      window.dispatchEvent(new Event('storage'));
      
      // 刷新首页数据
      loadLatest();
      loadHot();
      
      // 触发storage事件，通知Header组件更新使用量
      window.dispatchEvent(new Event('storage'));
      
      // 跳转到详情页
      setTimeout(() => {
        window.location.href = `/podcast/${result.id}`;
      }, 1000);

    } catch (error) {
      console.error('Processing failed:', error);
      
      // 更新处理状态为失败
      const updatedItems = items.map((item: any) => 
        item.id === processingId 
          ? { ...item, status: 'failed', progress: 0, error: error.message }
          : item
      );
      localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
      window.dispatchEvent(new Event('storage'));
      
      // 显示友好的错误信息
      const errorMessage = error.message || '处理失败，请重试';
      if (errorMessage.includes('请先登录')) {
        alert('请先登录后再处理播客');
        window.location.href = '/login';
      } else if (errorMessage.includes('额度已用完')) {
        alert('今日处理额度已用完，请明天再试');
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShowAllPodcasts = () => {
    if (!showAllPodcasts) {
      setShowAllPodcasts(true);
      loadAllPodcasts(1);
    } else {
      setShowAllPodcasts(false);
    }
  };

  const handlePageChange = (page: number) => {
    loadAllPodcasts(page);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        {/* 搜索区域 */}
        <div className="max-w-2xl mx-auto mb-8">
          <h1 className="text-3xl font-semibold text-center mb-3 text-gray-900">
            PodHome
          </h1>
          <p className="text-center text-gray-600 text-sm mb-6">
            输入播客链接或标题，其余都交给阿茂吧
          </p>
          
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入播客链接或标题..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isSearching ? '搜索中...' : '搜索'}
            </button>
          </div>

          {/* 权益说明 - 仅对游客显示 */}
          {!user && (
            <div className="mt-4 p-3 bg-white rounded-md border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                    游客：仅可搜索和浏览
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-900 rounded-full"></span>
                    用户：每天转录5个 + 评论互动
                  </span>
                </div>
                <a 
                  href="/register" 
                  className="text-gray-900 hover:underline font-medium"
                >
                  注册 →
                </a>
              </div>
            </div>
          )}

          {/* 搜索结果 */}
          {searchResult && (
            <div className="mt-4">
              {searchResult.hits && searchResult.hits.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900 text-sm">搜索结果：</h3>
                  {searchResult.hits.map((item) => (
                    <Link
                      key={item.id}
                      href={`/podcast/${item.id}`}
                      className="block p-3 bg-white rounded-md border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <h4 className="font-medium text-gray-900 text-sm">{item.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '未知时间'}
                      </p>
                      {item.summary && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              ) : searchResult.notFound ? (
                <div className="text-center py-6">
                  {user ? (
                    <button
                      onClick={() => handleProcessPodcast(searchQuery)}
                      disabled={isProcessing}
                      className="px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {isProcessing ? '处理中...' : '未找到相关播客，交给阿茂吧（每小时播客需约12分钟）'}
                    </button>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <div className="text-gray-800 text-sm">
                        <p className="font-medium mb-2">请联系 阿茅（Wechat：njumwh）获取邀请码</p>
                        <p className="text-gray-600">注册并登录，从而获得播客转录权限</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

        </div>

        {/* 两列内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 最新 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">最新</h2>
            {loading.latest ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : latest.length > 0 ? (
              <div className="space-y-3">
                {latest.map((item) => (
                  <Link
                    key={item.id}
                    href={`/podcast/${item.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '未知时间'}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                暂无最新播客
              </div>
            )}
          </div>

          {/* 最热 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">最热</h2>
            {loading.hot ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : hot.length > 0 ? (
              <div className="space-y-3">
                {hot.map((item) => (
                  <Link
                    key={item.id}
                    href={`/podcast/${item.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '未知时间'}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                暂无热门播客
              </div>
            )}
          </div>

        </div>

        {/* 所有播客展开区域 */}
        <div className="mt-8">
          <button
            onClick={handleShowAllPodcasts}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>{showAllPodcasts ? '收起' : '所有播客'}</span>
            <svg 
              className={`w-4 h-4 transition-transform ${showAllPodcasts ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAllPodcasts && (
            <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">所有播客</h2>
              
              {loading.allPodcasts ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {allPodcasts.map((item) => (
                      <Link
                        key={item.id}
                        href={`/podcast/${item.id}`}
                        className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-600">
                          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '未知时间'}
                        </p>
                      </Link>
                    ))}
                  </div>

                  {/* 分页 */}
                  {allPodcastsTotal > 10 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        共 {allPodcastsTotal} 个播客，第 {allPodcastsPage} 页
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePageChange(allPodcastsPage - 1)}
                          disabled={allPodcastsPage <= 1}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          上一页
                        </button>
                        <button
                          onClick={() => handlePageChange(allPodcastsPage + 1)}
                          disabled={allPodcastsPage * 10 >= allPodcastsTotal}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
