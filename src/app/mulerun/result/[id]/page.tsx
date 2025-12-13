"use client";

/**
 * MuleRun 专用播客详情页
 * 只显示播客信息，不包含 Header、Footer、导航等
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PodcastDetail {
  id: string;
  title: string;
  showAuthor?: string;
  summary?: string;
  reportOutline?: string;
  status: string;
}

export default function MulerunResultPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [podcast, setPodcast] = useState<PodcastDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchPodcast = async () => {
      try {
        const res = await fetch(`/api/public/podcast?id=${id}&_mulerun=true&_t=${Date.now()}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch podcast');
        }
        const data = await res.json();
        // API 直接返回播客数据，不是 { podcast: ... } 格式
        if (data.id) {
          setPodcast({
            id: data.id,
            title: data.title,
            showAuthor: data.author || data.showAuthor,
            summary: data.summary,
            reportOutline: data.reportOutline,
            status: 'READY',
          });
        } else {
          throw new Error('Invalid podcast data format');
        }
        setLoading(false);
      } catch (err) {
        console.error('[MuleRun] 获取播客失败:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load podcast';
        setError(errorMessage);
        setLoading(false);
      }
    };

    fetchPodcast();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !podcast) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-xl font-semibold mb-2">错误</div>
          <p className="text-gray-600">{error || '播客不存在'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-10 lg:p-10">
        {/* 标题和作者 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {podcast.title}
          </h1>
          {podcast.showAuthor && (
            <p className="text-lg text-gray-600">
              {podcast.showAuthor}
            </p>
          )}
        </div>

        {/* 摘要 */}
        {podcast.summary && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">摘要</h2>
            <div className="prose prose-lg max-w-none text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {podcast.summary}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* 报告大纲 */}
        {podcast.reportOutline && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">报告大纲</h2>
            <div className="prose prose-lg max-w-none text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {podcast.reportOutline}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {!podcast.summary && !podcast.reportOutline && (
          <div className="text-center text-gray-500 py-12">
            <p>暂无内容</p>
          </div>
        )}
      </div>
    </div>
  );
}

