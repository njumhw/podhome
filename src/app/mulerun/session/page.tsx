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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-xl font-semibold mb-2">Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 搜索框 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Podcast to Insight
          </h1>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Enter podcast URL (e.g., https://www.xiaoyuzhoufm.com/episode/...)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !inputUrl.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Processing...' : 'Process'}
            </button>
          </div>
        </div>

        {/* 示例播客 */}
        {examplePodcasts.length > 0 && queries.length === 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              <h2 className="text-xl font-bold text-gray-900 px-4">示例播客</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {examplePodcasts.map((podcast) => (
                <ExamplePodcastCard key={podcast.id} podcast={podcast} />
              ))}
            </div>
          </div>
        )}

        {/* 查询历史 */}
        {queries.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">查询历史</h2>
            {queries.map((query) => (
              <QueryCard key={query.id} query={query} />
            ))}
          </div>
        )}

        {queries.length === 0 && examplePodcasts.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
            No queries yet. Enter a podcast URL above to get started.
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
    <div className="bg-white rounded-lg shadow-sm p-6">
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
        <div className="mt-4 flex items-center gap-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
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

          {query.podcast.summary && (
            <div className="prose prose-sm max-w-none">
              <div className="text-gray-700 whitespace-pre-wrap">
                {query.podcast.summary}
              </div>
            </div>
          )}

          {query.podcast.reportOutline && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
                View Report Outline
              </summary>
              <div className="mt-2 prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {query.podcast.reportOutline}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// 示例播客卡片组件
function ExamplePodcastCard({ podcast }: { podcast: any }) {
  return (
    <div className="group relative bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-300 cursor-pointer overflow-hidden">
      {/* 装饰性背景元素 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-transparent opacity-50 rounded-full -mr-16 -mt-16 group-hover:opacity-70 transition-opacity"></div>
      
      <div className="relative z-10">
        {/* 标题 */}
        <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {podcast.title}
        </h3>
        
        {/* 作者 */}
        {podcast.showAuthor && (
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
              {podcast.showAuthor.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm text-gray-600 font-medium">
              {podcast.showAuthor}
            </p>
          </div>
        )}
        
        {/* 摘要 */}
        {podcast.summary && (
          <p className="text-sm text-gray-700 line-clamp-3 mb-4 leading-relaxed">
            {podcast.summary.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '').substring(0, 120)}...
          </p>
        )}
        
        {/* 操作按钮 */}
        <a
          href={`/mulerun/session?podcastId=${podcast.id}`}
          className="flex items-center gap-2 text-sm font-semibold text-blue-600 group-hover:text-blue-700 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            // 在实际使用中，这里可以跳转到详情页
          }}
        >
          <span>查看详情</span>
          <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
      
      {/* 悬停时的边框高光 */}
      <div className="absolute inset-0 rounded-xl border-2 border-blue-400 opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none"></div>
    </div>
  );
}

export default function MulerunSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <MulerunSessionPageContent />
    </Suspense>
  );
}

