"use client";

/**
 * MuleRun Session Page
 * Start Session URL - 严格按照 MuleRun 文档实现
 * 
 * 文档要求：
 * - 接收 URL 参数：userId, sessionId, agentId, time, origin, nonce, signature
 * - 验证签名
 * - 创建/恢复会话
 * - 显示处理界面（适配 iframe）
 */

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Query {
  id: string;
  queryUrl: string;
  status: string;
  podcastId?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  podcast?: {
    id: string;
    title: string;
    showAuthor?: string;
    summary?: string;
    reportOutline?: string;
    status: string;
  };
}

interface Session {
  id: string;
  sessionId: string;
  status: string;
  expiresAt: string;
}

function MulerunSessionPageContent() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [examplePodcasts, setExamplePodcasts] = useState<any[]>([]);

  // 初始化会话（验证签名并创建/恢复会话）
  useEffect(() => {
    const initSession = async () => {
      try {
        // 提取所有 URL 参数
        const params: Record<string, string> = {};
        searchParams.forEach((value, key) => {
          params[key] = value;
        });

        // 验证必需参数
        if (!params.userId || !params.sessionId || !params.agentId || 
            !params.time || !params.origin || !params.nonce || !params.signature) {
          setError('Missing required parameters');
          setLoading(false);
          return;
        }

        // 构建查询字符串
        const queryString = new URLSearchParams(params).toString();
        
        // 调用 API 创建/恢复会话（API 会验证签名）
        const res = await fetch(`/api/mulerun/session?${queryString}`, {
          method: 'POST',
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to initialize session');
          setLoading(false);
          return;
        }

        const data = await res.json();
        setSession(data.session);
        setQueries(data.queries || []);
        setLoading(false);
      } catch (err) {
        console.error('[MuleRun] 初始化会话失败:', err);
        setError('Failed to initialize session');
        setLoading(false);
      }
    };

    initSession();
  }, [searchParams]);

  // 加载示例播客
  useEffect(() => {
    const loadExamplePodcasts = async () => {
      try {
        const res = await fetch('/api/mulerun/examples');
        if (res.ok) {
          const data = await res.json();
          setExamplePodcasts(data.podcasts || []);
        }
      } catch (err) {
        console.error('Failed to load example podcasts:', err);
      }
    };

    loadExamplePodcasts();
  }, []);

  // 提交播客处理请求
  const handleSubmit = useCallback(async () => {
    if (!inputUrl.trim() || !session) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/mulerun/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          queryUrl: inputUrl.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit query');
        setSubmitting(false);
        return;
      }

      // 添加新查询到列表
      if (data.query) {
        setQueries(prev => [data.query, ...prev]);
      }

      // 如果是缓存结果，直接显示
      if (data.fromCache && data.query.podcast) {
        // 查询已完成，可以立即显示结果
      }

      setInputUrl('');
      setSubmitting(false);
    } catch (err) {
      console.error('[MuleRun] 提交查询失败:', err);
      setError('Failed to submit query');
      setSubmitting(false);
    }
  }, [inputUrl, session]);

  // 轮询查询状态
  useEffect(() => {
    if (!session) return;

    const pollingQueries = queries.filter(q => 
      q.status === 'pending' || q.status === 'processing'
    );

    if (pollingQueries.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mulerun/session?sessionId=${session.sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setQueries(data.queries || []);
        }
      } catch (err) {
        console.error('[MuleRun] 轮询状态失败:', err);
      }
    }, 5000); // 每 5 秒轮询一次

    return () => clearInterval(interval);
  }, [session, queries]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-xl font-semibold mb-2">Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // 分离已处理的播客和示例播客
  const processedQueries = queries.filter(q => q.status === 'completed' && q.podcast);
  const hasProcessed = processedQueries.length > 0;
  const showExamples = examplePodcasts.length > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* 像素风格背景装饰 */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, #FFD700 0px, #FFD700 20px, transparent 20px, transparent 40px, #FFD700 40px), repeating-linear-gradient(90deg, #FFD700 0px, #FFD700 20px, transparent 20px, transparent 40px, #FFD700 40px)',
        backgroundSize: '40px 40px'
      }}></div>
      
      <div className="relative max-w-6xl mx-auto px-6 py-8">
        {/* 标题和搜索框 */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-6 text-center">
            Podcast to Insight
          </h1>
          <div className="flex gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Enter podcast URL (e.g., https://www.xiaoyuzhoufm.com/episode/...)"
              className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 text-gray-900 placeholder-gray-400"
              disabled={submitting}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !inputUrl.trim()}
              className="px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              {submitting ? 'Processing...' : 'Process'}
            </button>
          </div>
        </div>

        {/* 已处理的播客 */}
        {hasProcessed && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Processed</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {processedQueries.map((query) => (
                query.podcast && (
                  <ProcessedPodcastCard key={query.id} query={query} />
                )
              ))}
            </div>
          </div>
        )}

        {/* 示例播客 */}
        {showExamples && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Example Podcasts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {examplePodcasts.map((podcast) => (
                <ExamplePodcastCard key={podcast.id} podcast={podcast} />
              ))}
            </div>
          </div>
        )}

        {/* 正在处理的查询 */}
        {queries.filter(q => q.status === 'pending' || q.status === 'processing').length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Processing</h2>
            <div className="space-y-4">
              {queries
                .filter(q => q.status === 'pending' || q.status === 'processing')
                .map((query) => (
                  <QueryCard key={query.id} query={query} />
                ))}
            </div>
          </div>
        )}

        {/* 失败的查询 */}
        {queries.filter(q => q.status === 'failed' || q.status === 'timeout').length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Failed</h2>
            <div className="space-y-4">
              {queries
                .filter(q => q.status === 'failed' || q.status === 'timeout')
                .map((query) => (
                  <QueryCard key={query.id} query={query} />
                ))}
            </div>
          </div>
        )}

        {queries.length === 0 && examplePodcasts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No queries yet. Enter a podcast URL above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 查询卡片组件
function QueryCard({ query }: { query: Query }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    timeout: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="text-sm text-gray-500 mb-1">
            {new Date(query.createdAt).toLocaleString()}
          </div>
          <div className="text-sm font-mono text-gray-700 break-all">
            {query.queryUrl}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          statusColors[query.status] || 'bg-gray-100 text-gray-800'
        }`}>
          {query.status}
        </span>
      </div>

      {query.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {query.error}
        </div>
      )}

      {query.status === 'processing' && (
        <div className="mt-4 flex items-center gap-2 text-gray-900">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
          <span className="text-sm">Processing podcast, please wait...</span>
        </div>
      )}

      {query.podcast && query.status === 'completed' && (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {query.podcast.title}
            </h3>
            {query.podcast.showAuthor && (
              <p className="text-sm text-gray-600 mb-2">
                by {query.podcast.showAuthor}
              </p>
            )}
          </div>

          <a
            href={`/mulerun/result/${query.podcast.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-semibold"
          >
            <span>View Details</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

// 已处理播客卡片组件
function ProcessedPodcastCard({ query }: { query: Query }) {
  if (!query.podcast) return null;

  return (
    <a
      href={`/mulerun/result/${query.podcast.id}`}
      className="group block bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-yellow-400 hover:shadow-lg transition-all duration-200"
    >
      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-yellow-600 transition-colors">
        {query.podcast.title}
      </h3>
      
      {query.podcast.showAuthor && (
        <p className="text-sm text-gray-600 mb-3">
          {query.podcast.showAuthor}
        </p>
      )}
      
      {query.podcast.summary && (
        <p className="text-sm text-gray-700 line-clamp-3 mb-4 leading-relaxed">
          {query.podcast.summary.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '').substring(0, 120)}...
        </p>
      )}
      
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 group-hover:text-yellow-600 transition-colors">
        <span>View Details</span>
        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  );
}

// 示例播客卡片组件
function ExamplePodcastCard({ podcast }: { podcast: any }) {
  return (
    <a
      href={`/mulerun/result/${podcast.id}`}
      className="group block bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-yellow-400 hover:shadow-lg transition-all duration-200"
    >
      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-yellow-600 transition-colors">
        {podcast.title}
      </h3>
      
      {podcast.showAuthor && (
        <p className="text-sm text-gray-600 mb-3">
          {podcast.showAuthor}
        </p>
      )}
      
      {podcast.summary && (
        <p className="text-sm text-gray-700 line-clamp-3 mb-4 leading-relaxed">
          {podcast.summary.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '').substring(0, 120)}...
        </p>
      )}
      
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 group-hover:text-yellow-600 transition-colors">
        <span>View Details</span>
        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  );
}

export default function MulerunSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <MulerunSessionPageContent />
    </Suspense>
  );
}

