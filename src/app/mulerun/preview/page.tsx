"use client";

/**
 * MuleRun Session 页面预览
 * 用于本地查看界面效果，不需要签名验证
 */

import { useEffect, useState, useCallback } from 'react';

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

export default function MulerunPreviewPage() {
  const [queries, setQueries] = useState<Query[]>([]);
  const [inputUrl, setInputUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [examplePodcasts, setExamplePodcasts] = useState<any[]>([]);

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

  // 提交播客处理请求（模拟）
  const handleSubmit = useCallback(async () => {
    if (!inputUrl.trim()) return;

    setSubmitting(true);
    
    // 模拟创建查询记录
    const newQuery: Query = {
      id: `query-${Date.now()}`,
      queryUrl: inputUrl.trim(),
      status: 'processing',
      createdAt: new Date().toISOString(),
    };

    setQueries(prev => [newQuery, ...prev]);
    setInputUrl('');

    // 模拟处理过程
    setTimeout(() => {
      setQueries(prev => prev.map(q => 
        q.id === newQuery.id 
          ? { ...q, status: 'processing' }
          : q
      ));
    }, 1000);

    // 模拟完成（3秒后）
    setTimeout(() => {
      setQueries(prev => prev.map(q => 
        q.id === newQuery.id 
          ? { 
              ...q, 
              status: 'completed',
              completedAt: new Date().toISOString(),
              podcast: {
                id: 'example-podcast-id',
                title: '示例播客标题',
                showAuthor: '示例作者',
                summary: '这是一个示例播客的总结内容。在实际使用中，这里会显示从播客中提取的完整总结。',
                reportOutline: '1. 第一部分\n2. 第二部分\n3. 第三部分',
                status: 'READY',
              }
            }
          : q
      ));
      setSubmitting(false);
    }, 3000);
  }, [inputUrl]);

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
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">
          <span>查看详情</span>
          <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      
      {/* 悬停时的边框高光 */}
      <div className="absolute inset-0 rounded-xl border-2 border-blue-400 opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none"></div>
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

