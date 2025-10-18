"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TopicModal from '@/components/TopicModal';
import { useToast } from '@/components/Toast';
import { SummaryDisplay } from '@/components/SummaryDisplay';

type Topic = {
  id: string;
  name: string;
  description?: string;
  color?: string;
};

type PodcastDetail = {
  id: string;
  title: string;
  author: string;
  publishedAt: string;
  audioUrl: string;
  originalUrl: string;
  summary: string | null;
  topic: Topic | null;
  script: string | null;
  // report字段已删除，只使用summary
  updatedAt: string;
};

type Comment = {
  id: string;
  content: string;
  author: string;
  likes: number;
  createdAt: string;
  liked: boolean;
};

export default function PodcastDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [podcast, setPodcast] = useState<PodcastDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  // 编辑相关状态
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showFullscreenReport, setShowFullscreenReport] = useState(false);
  const [showFullscreenScript, setShowFullscreenScript] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [downloadStatus, setDownloadStatus] = useState('');
  const [shareSuccess, setShareSuccess] = useState('');
  const [editData, setEditData] = useState({
    title: '',
    author: '',
    publishedAt: '',
    summary: '',
    script: '',
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const toast = useToast();
  
  const [showTopicModal, setShowTopicModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadPodcast();
      checkUser();
    }
  }, [id]);

  // 当播客数据加载完成后，再加载评论
  useEffect(() => {
    if (podcast?.id) {
      loadComments();
    }
  }, [podcast?.id]);


  const loadPodcast = async () => {
    try {
      // 添加时间戳防止缓存
      const res = await fetch(`/api/public/podcast?id=${id}&t=${Date.now()}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('播客不存在');
        } else if (res.status === 503) {
          throw new Error('数据库连接问题，请稍后重试');
        } else {
          throw new Error(`服务器错误 (${res.status})`);
        }
      }
      const data = await res.json();
      setPodcast(data);
      
      // 记录访问日志
      try {
        await fetch('/api/public/access-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audioCacheId: id }),
        });
      } catch (logError) {
        // 访问日志记录失败不影响主要功能
        console.warn('记录访问日志失败:', logError);
      }
    } catch (error) {
      console.error('Failed to load podcast:', error);
      setError('加载播客失败');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      // 如果播客数据还没有加载，直接返回
      if (!podcast?.id) {
        setComments([]);
        return;
      }

      const params = new URLSearchParams();
      // 检查是Podcast还是AudioCache
      if (podcast.id.startsWith('cmg')) {
        // 这是AudioCache ID
        params.append('audioCacheId', podcast.id);
      } else {
        // 这是Podcast ID
        params.append('podcastId', podcast.id);
      }

      const res = await fetch(`/api/comments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      } else {
        console.error('Failed to load comments:', res.statusText);
        setComments([]);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
      setComments([]);
    }
  };

  const checkUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const userData = await res.json();
        setUser(userData.user);
        setIsAdmin(userData.user?.role === 'ADMIN');
      }
    } catch (error) {
      console.error('Failed to check user:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user || !podcast) return;
    
    setIsSubmittingComment(true);
    try {
      const body: any = {
        content: newComment.trim(),
      };

      // 根据ID类型设置正确的字段
      if (podcast.id.startsWith('cmg')) {
        body.audioCacheId = podcast.id;
      } else {
        body.podcastId = podcast.id;
      }

      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        toast.success('评论发表成功！');
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || '发表评论失败');
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
      toast.error('发表评论失败');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      toast.error('请先登录');
      return;
    }

    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const action = comment.liked ? 'unlike' : 'like';

    try {
      const res = await fetch('/api/comments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentId,
          action,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, likes: data.likes, liked: data.liked }
            : c
        ));
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to like/unlike comment:', error);
      toast.error('操作失败');
    }
  };

  const handleTopicChange = (topic: Topic | null) => {
    if (podcast) {
      setPodcast({ ...podcast, topic });
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(`${type}已复制到剪贴板`);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      console.error('复制失败:', err);
      setCopySuccess('复制失败，请手动选择文本复制');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  };

  const handleDownload = async () => {
    if (!podcast?.audioUrl) return;
    
    setDownloadStatus('准备下载...');
    try {
      // 在新标签页中打开音频链接，让浏览器处理下载
      const link = document.createElement('a');
      link.href = podcast.audioUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = `${podcast.title.replace(/[^\w\s-]/g, '').trim()}.m4a`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDownloadStatus('下载已开始');
      setTimeout(() => setDownloadStatus(''), 3000);
    } catch (err) {
      setDownloadStatus('下载失败，请重试');
      setTimeout(() => setDownloadStatus(''), 3000);
    }
  };

  const handleShare = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      setShareSuccess('链接已复制');
      setTimeout(() => setShareSuccess(''), 1500);
    } catch (err) {
      setShareSuccess('复制失败');
      setTimeout(() => setShareSuccess(''), 1500);
    }
  };

  // 编辑相关函数
  const handleEdit = () => {
    if (podcast) {
      setEditData({
        title: podcast.title,
        author: podcast.author,
        publishedAt: podcast.publishedAt ? new Date(podcast.publishedAt).toISOString().split('T')[0] : '',
        summary: podcast.summary || '', // 使用 summary 字段
        script: podcast.script || '',
      });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({
      title: '',
      author: '',
      publishedAt: '',
      summary: '',
      script: '',
    });
  };

  const handleSaveEdit = async () => {
    if (!podcast) return;
    
    setIsSaving(true);
    try {
      const res = await fetch('/api/podcast/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: podcast.id,
          ...editData,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '保存失败');
      }

      const data = await res.json();
      
      // 更新本地状态
      setPodcast({
        ...podcast,
        title: editData.title,
        author: editData.author,
        publishedAt: editData.publishedAt,
        summary: editData.summary,
        script: editData.script,
      });
      
      setIsEditing(false);
      toast.success('保存成功！');
    } catch (error: any) {
      console.error('保存失败:', error);
      toast.error('保存失败', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !podcast) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">播客不存在</h1>
            <Link href="/home" className="text-blue-600 hover:text-blue-800">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* 基本信息 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                    <input
                      type="text"
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md text-lg font-bold text-gray-900"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
                      <input
                        type="text"
                        value={editData.author}
                        onChange={(e) => setEditData({ ...editData, author: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">发布时间</label>
                      <input
                        type="date"
                        value={editData.publishedAt}
                        onChange={(e) => setEditData({ ...editData, publishedAt: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-3">
                    <h1 className="text-3xl font-bold text-gray-900 flex-1">{podcast.title}</h1>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={handleShare}
                        className="p-1.5 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors"
                        title="分享播客"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                        </svg>
                      </button>
                      <Link
                        href="/home"
                        className="p-1.5 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors"
                        title="返回首页"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-700 mb-4">
                    <span>作者：{podcast.author}</span>
                    <span>发布时间：{podcast.publishedAt ? new Date(podcast.publishedAt).toLocaleDateString() : '未知时间'}</span>
                  </div>
                  
                  {/* 操作按钮区域 */}
                  <div className="flex items-center gap-1.5 mb-4">
                    {isAdmin && (
                      <>
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              disabled={isSaving}
                              className="p-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                              title={isSaving ? '保存中...' : '保存'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1.5 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors"
                              title="取消"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={handleEdit}
                            className="p-1.5 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors"
                            title="编辑"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                    {podcast?.audioUrl && (
                      <button
                        onClick={handleDownload}
                        className="p-1.5 bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors"
                        title="下载音频"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </>
              )}
              <div className="flex items-center gap-3">
                {podcast.topic ? (
                  <span 
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                    style={{ 
                      backgroundColor: podcast.topic.color + '20',
                      color: podcast.topic.color || '#3B82F6'
                    }}
                  >
                    {podcast.topic.name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-600">未设置专题</span>
                )}
                <button
                  onClick={() => setShowTopicModal(true)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  管理专题
                </button>
              </div>
            </div>
          </div>
          
        </div>

        {/* 报告和全文 */}
        {/* 主要内容区域 - 上下布局 */}
        <div className="space-y-8">
          {/* 播客总结 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">播客总结</h2>
              {podcast.summary && !isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(podcast.summary, '播客总结')}
                    className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1"
                    title="复制全文"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    复制
                  </button>
                  <button
                    onClick={() => setShowFullscreenReport(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
                  >
                    全屏阅读
                  </button>
                </div>
              )}
            </div>
            {isEditing ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">播客总结内容</label>
                <textarea
                  value={editData.summary}
                  onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
                  rows={15}
                  placeholder="请输入播客总结内容..."
                />
              </div>
            ) : (
              <SummaryDisplay 
                summary={podcast.summary}
                report={podcast.summary}
                fallbackText="暂无播客总结"
              />
            )}
          </div>

          {/* 访谈全文 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">访谈全文</h2>
              {podcast.script && !isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(podcast.script, '访谈全文')}
                    className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1"
                    title="复制全文"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    复制
                  </button>
                  <button
                    onClick={() => setShowFullscreenScript(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
                  >
                    全屏阅读
                  </button>
                </div>
              )}
            </div>
            {isEditing ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">访谈全文内容</label>
                <textarea
                  value={editData.script}
                  onChange={(e) => setEditData({ ...editData, script: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
                  rows={20}
                  placeholder="请输入访谈全文内容..."
                />
              </div>
            ) : (
              podcast.script ? (
                <div 
                  className="max-w-none overflow-y-auto overflow-x-hidden border border-gray-200 rounded-lg p-4"
                  style={{ 
                    height: '500px', 
                    wordWrap: 'break-word', 
                    overflowWrap: 'break-word',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    lineHeight: '1.3'
                  }}
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p style={{ 
                          wordWrap: 'break-word', 
                          overflowWrap: 'break-word', 
                          whiteSpace: 'normal', 
                          color: '#1f2937 !important', 
                          fontSize: '14px', 
                          lineHeight: '1.3',
                          margin: '0 0 8px 0'
                        }}>
                          {children}
                        </p>
                      ),
                      li: ({ children }) => (
                        <li style={{ 
                          wordWrap: 'break-word', 
                          overflowWrap: 'break-word', 
                          color: '#1f2937 !important', 
                          fontSize: '14px', 
                          lineHeight: '1.3',
                          margin: '0 0 2px 0'
                        }}>
                          {children}
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong style={{ 
                          wordWrap: 'break-word', 
                          overflowWrap: 'break-word', 
                          color: '#111827 !important', 
                          fontSize: '14px', 
                          lineHeight: '1.3',
                          fontWeight: 'bold'
                        }}>
                          {children}
                        </strong>
                      ),
                      h1: ({ children }) => (
                        <h1 style={{ 
                          color: '#111827 !important', 
                          fontSize: '18px', 
                          fontWeight: 'bold', 
                          lineHeight: '1.2',
                          marginBottom: '6px', 
                          marginTop: '8px' 
                        }}>
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 style={{ 
                          color: '#111827 !important', 
                          fontSize: '16px', 
                          fontWeight: 'bold', 
                          lineHeight: '1.2',
                          marginBottom: '4px', 
                          marginTop: '6px' 
                        }}>
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 style={{ 
                          color: '#111827 !important', 
                          fontSize: '15px', 
                          fontWeight: 'bold', 
                          lineHeight: '1.2',
                          marginBottom: '2px', 
                          marginTop: '4px' 
                        }}>
                          {children}
                        </h3>
                      )
                    }}
                  >
                    {podcast.script}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-gray-600 text-center py-8">
                  暂无访谈全文
                </div>
              )
            )}
          </div>
          {/* 评论区 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">评论区</h2>
            
            {/* 发表评论 */}
            {user ? (
              <div className="mb-6">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="写下你的评论..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingComment ? '提交中...' : '发表评论'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-gray-700 mb-2">请先登录后发表评论</p>
                <Link href="/login" className="text-blue-600 hover:text-blue-800">
                  立即登录
                </Link>
              </div>
            )}

            {/* 评论列表 */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center text-gray-600 py-8">
                  暂无评论，来发表第一条评论吧！
                </div>
              ) : (
                <>
                  {/* 按点赞数排序（后端已排序），默认显示前5条 */}
                  {comments
                    .slice(0, showAllComments ? comments.length : 5)
                    .map((comment) => (
                    <div key={comment.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{comment.author}</span>
                            <span className="text-xs text-gray-600">
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-700">{comment.content}</p>
                        </div>
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                            comment.liked
                              ? 'text-red-600 bg-red-50 border border-red-200'
                              : 'text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 border border-gray-200'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.834a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                          </svg>
                          <span className="font-medium">{comment.likes}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* 展开/收起按钮 */}
                  {comments.length > 5 && (
                    <div className="text-center pt-4">
                      <button
                        onClick={() => setShowAllComments(!showAllComments)}
                        className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {showAllComments ? '收起评论' : `展开全部 ${comments.length} 条评论`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 专题管理模态框 */}
      <TopicModal
        isOpen={showTopicModal}
        onClose={() => setShowTopicModal(false)}
        podcastId={podcast.id}
        currentTopic={podcast.topic}
        onTopicChange={handleTopicChange}
      />

      {/* 复制成功提示 */}
      {copySuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300">
          {copySuccess}
        </div>
      )}

      {/* 下载状态提示 */}
      {downloadStatus && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300">
          {downloadStatus}
        </div>
      )}

      {shareSuccess && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white px-3 py-1.5 rounded-md shadow-lg z-50 transition-opacity duration-300 text-xs">
          {shareSuccess}
        </div>
      )}

      {/* 全屏播客总结模态框 */}
      {showFullscreenReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">播客总结</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleCopy(podcast.summary, '播客总结')}
                  className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1"
                  title="复制全文"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制
                </button>
                <button
                  onClick={() => setShowFullscreenReport(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-lg max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p style={{ color: '#1f2937', fontSize: '16px', lineHeight: '1.7', marginBottom: '16px' }}>
                        {children}
                      </p>
                    ),
                    li: ({ children }) => (
                      <li style={{ color: '#1f2937', fontSize: '16px', lineHeight: '1.7', marginBottom: '8px' }}>
                        {children}
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ color: '#111827', fontSize: '16px', lineHeight: '1.7' }}>
                        {children}
                      </strong>
                    ),
                    h1: ({ children }) => (
                      <h1 style={{ color: '#111827', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', marginTop: '24px' }}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 style={{ color: '#111827', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', marginTop: '20px' }}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 style={{ color: '#111827', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', marginTop: '16px' }}>
                        {children}
                      </h3>
                    )
                  }}
                >
                  {podcast.summary}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 全屏访谈全文模态框 */}
      {showFullscreenScript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">访谈全文</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleCopy(podcast.script, '访谈全文')}
                  className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1"
                  title="复制全文"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制
                </button>
                <button
                  onClick={() => setShowFullscreenScript(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-lg max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p style={{ color: '#1f2937', fontSize: '16px', lineHeight: '1.7', marginBottom: '16px' }}>
                        {children}
                      </p>
                    ),
                    li: ({ children }) => (
                      <li style={{ color: '#1f2937', fontSize: '16px', lineHeight: '1.7', marginBottom: '8px' }}>
                        {children}
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ color: '#111827', fontSize: '16px', lineHeight: '1.7' }}>
                        {children}
                      </strong>
                    ),
                    h1: ({ children }) => (
                      <h1 style={{ color: '#111827', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', marginTop: '24px' }}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 style={{ color: '#111827', fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', marginTop: '20px' }}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 style={{ color: '#111827', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', marginTop: '16px' }}>
                        {children}
                      </h3>
                    )
                  }}
                >
                  {podcast.script}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
