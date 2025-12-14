"use client";

/**
 * MuleRun 专用播客详情页
 * 只显示播客信息，不包含 Header、Footer、导航等
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CompactAudioPlayer from '@/components/CompactAudioPlayer';

interface PodcastDetail {
  id: string;
  title: string;
  showAuthor?: string;
  audioUrl?: string;
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
        const url = `/api/public/podcast?id=${id}&_mulerun=true&_t=${Date.now()}`;
        console.log('[MuleRun] 开始获取播客:', { id, url });
        
        const res = await fetch(url);
        console.log('[MuleRun] API 响应状态:', res.status, res.statusText);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('[MuleRun] API 返回错误:', errorData);
          throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log('[MuleRun] API 返回数据:', { 
          hasId: !!data.id, 
          hasTitle: !!data.title,
          hasSummary: !!data.summary,
          keys: Object.keys(data)
        });
        
        // API 直接返回播客数据，不是 { podcast: ... } 格式
        if (data.id) {
          setPodcast({
            id: data.id,
            title: data.title,
            showAuthor: data.author || data.showAuthor,
            audioUrl: data.audioUrl,
            summary: data.summary,
            reportOutline: data.reportOutline,
            status: 'READY',
          });
          console.log('[MuleRun] 播客数据已设置:', data.id, data.title);
        } else {
          console.error('[MuleRun] 数据格式无效:', data);
          throw new Error(`Invalid podcast data format: missing id. Received keys: ${Object.keys(data).join(', ')}`);
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
      {/* 全局样式：改善 Markdown 排版 */}
      <style jsx global>{`
        .mulerun-prose p {
          margin-bottom: 1.5em !important;
          line-height: 1.8 !important;
        }
        .mulerun-prose h1, .mulerun-prose h2, .mulerun-prose h3, 
        .mulerun-prose h4, .mulerun-prose h5, .mulerun-prose h6 {
          margin-top: 1.5em !important;
          margin-bottom: 0.75em !important;
          line-height: 1.4 !important;
          font-weight: 600 !important;
        }
        .mulerun-prose h1 {
          font-size: 1.875em !important;
        }
        .mulerun-prose h2 {
          font-size: 1.5em !important;
        }
        .mulerun-prose h3 {
          font-size: 1.25em !important;
        }
        .mulerun-prose ul, .mulerun-prose ol {
          margin-bottom: 1.5em !important;
          padding-left: 1.5em !important;
        }
        .mulerun-prose li {
          margin-bottom: 0.5em !important;
          line-height: 1.8 !important;
        }
        .mulerun-prose blockquote {
          margin: 1.5em 0 !important;
          padding-left: 1em !important;
          border-left: 4px solid #e5e7eb !important;
          color: #6b7280 !important;
        }
        .mulerun-prose code {
          padding: 0.2em 0.4em !important;
          background-color: #f3f4f6 !important;
          border-radius: 0.25rem !important;
          font-size: 0.9em !important;
          font-family: 'JetBrains Mono', monospace !important;
        }
        .mulerun-prose pre {
          margin: 1.5em 0 !important;
          padding: 1em !important;
          background-color: #f3f4f6 !important;
          border-radius: 0.5rem !important;
          overflow-x: auto !important;
        }
        .mulerun-prose pre code {
          background-color: transparent !important;
          padding: 0 !important;
        }
        .mulerun-prose strong {
          font-weight: 600 !important;
        }
        .mulerun-prose em {
          font-style: italic !important;
        }
        .mulerun-prose a {
          color: #3b82f6 !important;
          text-decoration: underline !important;
        }
        .mulerun-prose a:hover {
          color: #2563eb !important;
        }
        .mulerun-prose hr {
          margin: 2em 0 !important;
          border: none !important;
          border-top: 1px solid #e5e7eb !important;
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-6 py-10 lg:p-10">
        {/* 标题和作者 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
            {podcast.title}
          </h1>
          {podcast.showAuthor && (
            <p className="text-lg text-gray-600 mb-6">
              {podcast.showAuthor}
            </p>
          )}
        </div>

        {/* 音频播放器 */}
        {podcast.audioUrl && (
          <div className="mb-10">
            <CompactAudioPlayer audioUrl={podcast.audioUrl} title={podcast.title} />
          </div>
        )}

        {/* 摘要 */}
        {podcast.summary && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">摘要</h2>
            <div className="mulerun-prose prose prose-lg max-w-none text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {podcast.summary}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* 报告大纲 */}
        {podcast.reportOutline && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">报告大纲</h2>
            <div className="mulerun-prose prose prose-lg max-w-none text-gray-700">
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

