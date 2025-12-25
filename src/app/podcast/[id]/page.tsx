"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TopicModal from '@/components/TopicModal';
import { useToast } from '@/components/Toast';
import { SummaryDisplay } from '@/components/SummaryDisplay';
import LikeButton from '@/components/LikeButton';
import MinimalLikeButton from '@/components/MinimalLikeButton';
import AudioPlayer from '@/components/AudioPlayer';
import CompactAudioPlayer from '@/components/CompactAudioPlayer';
import { getStyleFromTitle } from '@/utils/podcast-styles';
import VisitorLimitModal from '@/components/VisitorLimitModal';

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
  translatedSummary: string | null; // 中文翻译总结
  topic: Topic | null;
  script: string | null; // 清洗稿（已移除，始终为null）
  originalTranscript: string | null; // ASR原文
  translatedTranscript: string | null; // 中文翻译原文
  reportOutline: string | null; // 报告大纲
  // report字段已删除，只使用summary
  updatedAt: string;
  likeCount?: number;
  isLimited?: boolean; // 是否受限（访客权限用完）
  visitorLimitExceeded?: boolean; // 访客权限是否已用完
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
  const [showASR, setShowASR] = useState(false); // 控制ASR原文的展开/收起（移除清洗版相关状态）
  const [asrTab, setAsrTab] = useState<'asr' | 'outline'>('asr'); // ASR原文区域的tab：'asr' 或 'outline'
  const [copySuccess, setCopySuccess] = useState('');
  const [downloadStatus, setDownloadStatus] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
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
  const [showVisitorLimitModal, setShowVisitorLimitModal] = useState(false);
  const [visitorLimitInfo, setVisitorLimitInfo] = useState<{ count: number; limit: number } | null>(null);
  const [isContentLimited, setIsContentLimited] = useState(false); // 内容是否受限
  const [isEnglishOriginal, setIsEnglishOriginal] = useState(true); // 是否显示英文原文（默认显示英文，如果有翻译则显示中文）
  
  // 共享的点赞状态，用于同步两个点赞按钮
  const [sharedLikeState, setSharedLikeState] = useState<{ liked: boolean; likeCount: number } | null>(null);

  useEffect(() => {
    if (id) {
      // 先检查用户状态，再加载播客（确保 user 状态正确）
      checkUser().then((userData) => {
        // 确保用户状态已设置后再加载播客
        if (userData) {
          setUser(userData);
          setIsAdmin(userData?.role === 'ADMIN');
        }
        // 传递用户信息给 loadPodcast
        loadPodcast(userData);
      });
    }
  }, [id]);

  // 当播客数据加载完成后，再加载评论
  useEffect(() => {
    if (podcast?.id) {
      loadComments();
    }
  }, [podcast?.id]);


  const loadPodcast = async (currentUser?: any) => {
    try {
      // 添加超时控制（15秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      try {
        // 添加时间戳防止缓存
        const res = await fetch(`/api/public/podcast?id=${id}&t=${Date.now()}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
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
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('请求超时：播客详情加载时间过长，请刷新页面重试');
        }
        throw fetchError;
      }
      
      // 如果有翻译字段（说明是英文播客），默认显示英文总结
      if (data.translatedSummary || data.translatedTranscript) {
        setIsEnglishOriginal(true); // 默认显示英文
      } else {
        setIsEnglishOriginal(false); // 中文播客，只显示中文
      }
      
      // 初始化共享点赞状态（从播客数据获取初始值）
      // 使用传入的 currentUser 参数，如果没有则使用 user 状态
      const userToCheck = currentUser !== undefined ? currentUser : user;
      setSharedLikeState({
        liked: false, // 将在下面从API获取实际状态
        likeCount: data.likeCount || 0,
      });
      
      // 获取实际的点赞状态（如果用户已登录）
      if (userToCheck) {
        try {
          const likeResponse = await fetch(`/api/podcast/like?podcastId=${id}`);
          if (likeResponse.ok) {
            const likeData = await likeResponse.json();
            setSharedLikeState({
              liked: likeData.liked,
              likeCount: likeData.likeCount,
            });
          }
        } catch (error) {
          console.error('获取点赞状态失败:', error);
        }
      }
      
      // 检查是否受限
      // 注意：只有真正的 Visitor（未登录用户）才会受限
      // 已登录用户（包括 READER, PODCASTER, PODCASTER_VIP, ADMIN）都不应该被限制
      // 如果用户已登录，即使 API 返回 isLimited，也应该忽略（可能是 API 端的 bug）
      const isLimited = !user && (data.isLimited || data.visitorLimitExceeded);
      setIsContentLimited(isLimited);
      
      // 只有 Visitor 才显示 visitorInfo
      if (!user && data.visitorInfo) {
        const info = {
          count: data.visitorInfo.used ?? 0,
          limit: data.visitorInfo.total ?? 3,
        };
        setVisitorLimitInfo(info);
        // 如果内容受限，不显示模态框（使用遮罩代替）
        if (isLimited) {
          setShowVisitorLimitModal(false);
        } else if (info.count >= info.limit) {
          setShowVisitorLimitModal(true);
        } else {
          setShowVisitorLimitModal(false);
        }
      } else {
        // 已登录用户不应该有 visitorInfo
        setVisitorLimitInfo(null);
        setShowVisitorLimitModal(false);
        setIsContentLimited(false); // 确保已登录用户不受限
      }
      
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 根据错误类型设置更具体的错误信息
      if (errorMessage.includes('数据库连接') || errorMessage.includes('数据库查询失败')) {
        setError('数据库连接问题，请稍后重试');
      } else if (errorMessage.includes('播客不存在')) {
        setError('播客不存在');
      } else {
        setError(`加载播客失败: ${errorMessage}`);
      }
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
      const res = await fetch('/api/auth/me', {
        credentials: "include", // 确保发送 Cookie
      });
      if (res.ok) {
        const userData = await res.json();
        const user = userData.user;
        setUser(user);
        // 只有明确是 ADMIN 角色的用户才设置为管理员
        setIsAdmin(user?.role === 'ADMIN');
        setShowVisitorLimitModal(false);
        return user; // 返回用户数据
      } else {
        // 如果请求失败，确保 isAdmin 为 false
        setIsAdmin(false);
        setUser(null);
        setShowVisitorLimitModal(false);
        return null;
      }
    } catch (error) {
      console.error('Failed to check user:', error);
      // 出错时也确保 isAdmin 为 false
      setIsAdmin(false);
      setUser(null);
      setShowVisitorLimitModal(false);
      return null;
    }
  };


  // loadASR函数已移除：ASR原文直接从podcast.originalTranscript获取

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
    // 优先使用现代 Clipboard API（需要 HTTPS 或 localhost）
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        setCopySuccess(`${type}已复制到剪贴板`);
        setCopiedText(true);
        setTimeout(() => {
          setCopySuccess('');
          setCopiedText(false);
        }, 2000);
        return;
      } catch (err) {
        console.warn('Clipboard API 失败，尝试降级方案:', err);
        // 继续尝试降级方案
      }
    }
    
    // 降级方案：使用传统的 execCommand 方法（适用于 HTTP 环境）
    try {
      // 创建一个临时的 textarea 元素
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      // 尝试复制
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        setCopySuccess(`${type}已复制到剪贴板`);
        setCopiedText(true);
        setTimeout(() => {
          setCopySuccess('');
          setCopiedText(false);
        }, 2000);
      } else {
        throw new Error('execCommand 复制失败');
      }
    } catch (err) {
      console.error('复制失败:', err);
      // 最后的降级方案：提示用户手动复制
      setCopySuccess('复制失败，请手动选择文本复制（Ctrl+C 或 Cmd+C）');
      setTimeout(() => setCopySuccess(''), 5000);
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
    const currentUrl = window.location.href;
    
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(currentUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
        return;
      } catch (err) {
        console.warn('Clipboard API 失败，尝试降级方案:', err);
        // 继续尝试降级方案
      }
    }
    
    // 降级方案：使用传统的 execCommand 方法
    try {
      const textarea = document.createElement('textarea');
      textarea.value = currentUrl;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } else {
        throw new Error('execCommand 复制失败');
      }
    } catch (err) {
      console.error('复制失败:', err);
      toast.error('复制失败', '请手动复制链接');
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
        script: podcast.originalTranscript || '', // 编辑ASR原文
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
        script: null, // 清洗稿已移除
        originalTranscript: editData.script, // 更新ASR原文
      });
      
      setIsEditing(false);
      toast.success('保存成功！');
    } catch (error: unknown) {
      console.error('保存失败:', error);
      toast.error('保存失败', error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black dark:bg-black [data-theme='light']:bg-background">
        <div className="max-w-[1536px] mx-auto px-8 py-12 space-y-8">
          <div className="skeleton-block h-12 w-3/4"></div>
          <div className="skeleton-block h-4 w-1/3"></div>
          <div className="space-y-10">
            <div className="skeleton-block h-96 w-full"></div>
            <div className="skeleton-block h-96 w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !podcast) {
    return (
      <div className="min-h-screen bg-black">
        <div className="max-w-[1536px] mx-auto px-8 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white dark:text-white [data-theme='light']:text-foreground mb-6 font-sans">播客不存在</h1>
            <Link href="/home" className="text-indigo-400 hover:text-indigo-300 transition-colors font-mono text-sm">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const accentStyle = getStyleFromTitle(podcast.title);

  return (
    <div className="min-h-screen bg-black dark:bg-black [data-theme='light']:bg-background">
      <div className="max-w-6xl mx-auto px-8 py-12 relative">
        {/* 返回首页按钮 - 右上角 */}
        <div className="absolute top-0 right-6">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-400 [data-theme='light']:text-slate-600 hover:text-white dark:hover:text-white [data-theme='light']:hover:text-foreground transition-colors font-mono"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回首页
          </Link>
        </div>

        {/* Header: 标题和元数据 */}
        <div className="mb-12">
          {isEditing ? (
            <div className="space-y-4 p-6 rounded-lg border border-white/5 bg-zinc-900/40 backdrop-blur-sm">
              {isAdmin && (
                <div className="flex items-center justify-end gap-3 mb-4">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs text-emerald-300 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/10 disabled:opacity-50 transition-colors font-mono"
                  >
                    {isSaving ? '保存中…' : '保存'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs text-zinc-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors font-mono"
                  >
                    取消
                  </button>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 font-mono">标题</label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="w-full p-3 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg text-lg font-bold bg-black/40 dark:bg-black/40 [data-theme='light']:bg-white text-white dark:text-white [data-theme='light']:text-foreground focus:outline-none focus:border-white/10 dark:focus:border-white/10 [data-theme='light']:focus:border-slate-300 font-sans"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-2 font-mono">作者</label>
                  <input
                    type="text"
                    value={editData.author}
                    onChange={(e) => setEditData({ ...editData, author: e.target.value })}
                    className="w-full p-3 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg bg-black/40 dark:bg-black/40 [data-theme='light']:bg-white text-white dark:text-white [data-theme='light']:text-foreground focus:outline-none focus:border-white/10 dark:focus:border-white/10 [data-theme='light']:focus:border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-2 font-mono">发布时间</label>
                  <input
                    type="date"
                    value={editData.publishedAt}
                    onChange={(e) => setEditData({ ...editData, publishedAt: e.target.value })}
                    className="w-full p-3 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg bg-black/40 dark:bg-black/40 [data-theme='light']:bg-white text-white dark:text-white [data-theme='light']:text-foreground focus:outline-none focus:border-white/10 dark:focus:border-white/10 [data-theme='light']:focus:border-slate-300 font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Media Deck - 统一的媒体卡片 */}
              <div className="rounded-3xl bg-zinc-900/60 dark:bg-zinc-900/60 [data-theme='light']:bg-card-surface backdrop-blur-xl border border-white/10 dark:border-white/10 [data-theme='light']:border-card-border p-8 mb-12">
                {/* Top: 标题和元数据 */}
                <div className="mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold mb-6 text-white dark:text-white [data-theme='light']:text-foreground font-sans leading-tight">
                    {podcast.title.replace(/\s*[-|]\s*[^-|]+$/, '').trim()}
                  </h1>
                  
                  {/* 元数据标签 */}
                  <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
                    {podcast.author && (
                      <span className="tag-pill px-3 py-1.5 rounded-lg border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 bg-white/5 dark:bg-white/5 [data-theme='light']:bg-slate-100 text-white/90 dark:text-white/90 [data-theme='light']:!text-slate-900">
                        {podcast.author}
                      </span>
                    )}
                    {podcast.publishedAt && (
                      <span className="text-zinc-400 dark:text-zinc-400 [data-theme='light']:text-slate-700">
                        {new Date(podcast.publishedAt).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </span>
                    )}
                    {podcast.topic && (
                      <span 
                        className="topic-pill px-3 py-1.5 rounded-lg border dark:bg-white/5 [data-theme='light']:bg-slate-100"
                        style={{ 
                          borderColor: (podcast.topic.color || '#818cf8') + '40',
                          backgroundColor: (podcast.topic.color || '#818cf8') + '10',
                          color: podcast.topic.color || '#818cf8'
                        }}
                      >
                        #{podcast.topic.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle: 可视化进度条 */}
                {podcast.audioUrl && (
                  <div className="mb-6">
                    <CompactAudioPlayer audioUrl={podcast.audioUrl} title={podcast.title} />
                  </div>
                )}

                {/* Bottom: 播放控制和操作按钮 */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200">
                  {/* 左侧：播放控制（已在CompactAudioPlayer中） */}
                  <div className="flex-1"></div>
                  
                  {/* 右侧：操作按钮 */}
                  <div className="flex items-center gap-2">
                    {isAdmin && !isEditing && (
                      <button
                        onClick={handleEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-400 [data-theme='light']:text-slate-700 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-300 rounded-lg hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-100 transition-colors font-mono"
                        title="编辑"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        编辑
                      </button>
                    )}
                    {podcast?.audioUrl && (
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-400 [data-theme='light']:text-slate-700 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-300 rounded-lg hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-100 transition-colors font-mono"
                        title="下载音频"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        下载
                      </button>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-400 [data-theme='light']:text-slate-700 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-300 rounded-lg hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-100 transition-colors font-mono"
                        title="分享播客"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        分享
                      </button>
                      {shareCopied && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-500 [data-theme='light']:text-slate-600 font-mono">
                          已复制链接
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 主要内容区域 - 单列布局 */}
        <div className="space-y-10">
          {/* AI Insights Section - 功能工具栏样式 */}
          <div>
            {/* Header: 工具栏样式 */}
            <div className="flex justify-between items-center mb-6">
              {/* Left: Title + Like Button */}
              <div className="flex items-center gap-4">
                {/* 科技感洞察图标 */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-6 h-6 text-pink-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                  <line x1="12" y1="4" x2="12" y2="10" />
                  <line x1="12" y1="14" x2="12" y2="20" />
                  <line x1="4" y1="12" x2="10" y2="12" />
                  <line x1="14" y1="12" x2="20" y2="12" />
                  <line x1="5.66" y1="5.66" x2="9.17" y2="9.17" />
                  <line x1="14.83" y1="14.83" x2="18.34" y2="18.34" />
                  <line x1="18.34" y1="5.66" x2="14.83" y2="9.17" />
                  <line x1="9.17" y1="14.83" x2="5.66" y2="18.34" />
                  <circle cx="12" cy="4" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="20" r="1.5" fill="currentColor" />
                  <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="20" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="5.66" cy="5.66" r="1.5" fill="currentColor" />
                  <circle cx="18.34" cy="18.34" r="1.5" fill="currentColor" />
                  <circle cx="18.34" cy="5.66" r="1.5" fill="currentColor" />
                  <circle cx="5.66" cy="18.34" r="1.5" fill="currentColor" />
                </svg>
                <h2 className="text-2xl font-bold font-sans text-white dark:text-white [data-theme='light']:text-foreground">Insight</h2>
                {/* 翻译切换按钮（仅当有翻译时显示） */}
                {podcast.translatedSummary && (
                  <button
                    onClick={() => setIsEnglishOriginal(!isEnglishOriginal)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-200 rounded-lg bg-white/5 dark:bg-white/5 [data-theme='light']:bg-white hover:bg-white/10 dark:hover:bg-white/10 [data-theme='light']:hover:bg-slate-100 text-white dark:text-white [data-theme='light']:text-slate-700 transition-colors"
                    title={isEnglishOriginal ? '切换到中文翻译' : '切换到英文原文'}
                  >
                    <span>{isEnglishOriginal ? 'EN' : '中'}</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>
                )}
                <MinimalLikeButton 
                  podcastId={podcast.id} 
                  initialLikeCount={podcast.likeCount || 0}
                  initialLiked={sharedLikeState?.liked}
                  externalLiked={sharedLikeState?.liked}
                  externalLikeCount={sharedLikeState?.likeCount}
                  disableInitialFetch={!!user} // 如果用户已登录，禁用初始获取（已在页面加载时获取）
                  onStatusChange={(liked, likeCount) => {
                    setSharedLikeState({ liked, likeCount });
                  }}
                />
              </div>
              
              {/* Right: Copy Button */}
              {podcast.summary && !isEditing && (
                <button
                  onClick={() => handleCopy(
                    isEnglishOriginal && podcast.translatedSummary 
                      ? podcast.summary || '' 
                      : (podcast.translatedSummary || podcast.summary || ''), 
                    'AI Insights'
                  )}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-400 [data-theme='light']:text-slate-600 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-100 hover:text-white dark:hover:text-white [data-theme='light']:hover:text-foreground transition-colors font-mono"
                  title="复制全文"
                >
                  {copiedText ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
            {isEditing ? (
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 font-mono">播客总结内容</label>
                <textarea
                  value={editData.summary}
                  onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
                  className="w-full p-4 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg bg-black/40 dark:bg-black/40 [data-theme='light']:bg-white text-white dark:text-white [data-theme='light']:text-foreground focus:outline-none focus:border-white/10 dark:focus:border-white/10 [data-theme='light']:focus:border-slate-300 font-sans text-base leading-relaxed"
                  rows={15}
                  placeholder="请输入播客总结内容..."
                />
              </div>
            ) : (
              <div className="prose prose-invert dark:prose-invert [data-theme='light']:prose prose-lg max-w-none relative">
                <SummaryDisplay 
                  summary={
                    isEnglishOriginal && podcast.translatedSummary
                      ? podcast.summary  // 显示英文总结（英文播客的summary字段）
                      : (podcast.translatedSummary || podcast.summary)  // 显示中文总结（如果有translatedSummary则显示，否则显示summary）
                  }
                  report={
                    isEnglishOriginal && podcast.translatedSummary
                      ? podcast.summary
                      : (podcast.translatedSummary || podcast.summary)
                  }
                  fallbackText="暂无播客总结"
                />
                {/* 内容受限遮罩 */}
                {isContentLimited && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black/90 backdrop-blur-sm flex items-end justify-center pb-8 pointer-events-auto">
                    <div className="bg-zinc-900/95 dark:bg-zinc-900/95 [data-theme='light']:bg-white/95 border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                      <div className="text-center mb-4">
                        <div className="text-3xl mb-3">🔒</div>
                        <h3 className="text-lg font-bold text-white dark:text-white [data-theme='light']:text-foreground mb-2">
                          今日查看次数已用完
                        </h3>
                        <p className="text-sm text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 mb-4">
                          您今天已经查看了 {visitorLimitInfo?.count || 3} 个播客详情。
                          <br />
                          注册登录后可无限浏览所有播客！
                        </p>
                      </div>
                      <div className="space-y-3">
                        <Link
                          href="/register"
                          className="block w-full px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-zinc-200 transition-colors text-center"
                        >
                          立即注册
                        </Link>
                        <Link
                          href="/login"
                          className="visitor-login-btn block w-full px-6 py-3 bg-zinc-800 dark:bg-zinc-800 [data-theme='light']:bg-slate-900 text-white dark:text-white border border-white/10 rounded-lg font-bold hover:bg-zinc-700 dark:hover:bg-zinc-700 [data-theme='light']:hover:bg-slate-800 transition-colors text-center"
                        >
                          登录
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isEditing && (
              <div className="mt-6 flex flex-wrap items-center gap-3 justify-between border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 bg-white dark:bg-black/30 shadow-none">
                <div className="text-sm text-slate-900 dark:text-zinc-300 font-mono">
                  值得一读？快点赞并分享给你的小伙伴们吧
                </div>
                <div className="flex items-center gap-2">
                  <MinimalLikeButton 
                    podcastId={podcast.id} 
                    initialLikeCount={podcast.likeCount || 0}
                    initialLiked={sharedLikeState?.liked}
                    externalLiked={sharedLikeState?.liked}
                    externalLikeCount={sharedLikeState?.likeCount}
                    disableInitialFetch={!!user} // 如果用户已登录，禁用初始获取（已在页面加载时获取）
                    onStatusChange={(liked, likeCount) => {
                      setSharedLikeState({ liked, likeCount });
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 border border-white/5 rounded-lg hover:bg-white/5 transition-colors font-mono"
                      title="分享播客"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      分享
                    </button>
                    {shareCopied && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-500 [data-theme='light']:text-slate-600 font-mono">
                        已复制链接
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Discussion Section - Glassmorphism Panel */}
          <div className="rounded-2xl border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-200 bg-white/5 dark:bg-white/5 [data-theme='light']:bg-white/90 backdrop-blur-xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-8 font-sans text-white dark:text-white [data-theme='light']:text-foreground">Discussion</h2>
            
            {/* Comment Input */}
            {user ? (
              <div className="mb-8">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="写下你的评论..."
                  className="w-full px-4 py-3 border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-200 rounded-xl bg-white/5 dark:bg-white/5 [data-theme='light']:bg-white backdrop-blur-sm text-white dark:text-white [data-theme='light']:text-foreground placeholder-zinc-400 dark:placeholder-zinc-400 [data-theme='light']:placeholder-slate-400 focus:outline-none focus:border-white/20 dark:focus:border-white/20 [data-theme='light']:focus:border-slate-300 focus:bg-white/10 dark:focus:bg-white/10 [data-theme='light']:focus:bg-white resize-none font-sans text-base transition-all"
                  rows={3}
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                    className="px-4 py-2 bg-white/10 dark:bg-white/10 [data-theme='light']:bg-slate-900 hover:bg-white/20 dark:hover:bg-white/20 [data-theme='light']:hover:bg-slate-800 border border-white/20 dark:border-white/20 [data-theme='light']:border-slate-300 rounded-xl text-white dark:text-white [data-theme='light']:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono text-xs backdrop-blur-sm"
                  >
                    {isSubmittingComment ? '提交中...' : '发表评论'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-xl text-center backdrop-blur-sm">
                <p className="text-white dark:text-white [data-theme='light']:text-slate-700 mb-2 font-sans text-sm">请先登录后发表评论</p>
                <Link href="/login" className="text-white dark:text-white [data-theme='light']:text-foreground hover:text-zinc-200 dark:hover:text-zinc-200 [data-theme='light']:hover:text-slate-800 underline transition-colors font-sans text-sm">
                  立即登录
                </Link>
              </div>
            )}

            {/* Comment List */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center text-white dark:text-white [data-theme='light']:text-slate-600 py-12 font-sans text-sm">
                  暂无评论，来发表第一条评论吧！
                </div>
              ) : (
                <>
                  {/* 按点赞数排序（后端已排序），默认显示前5条 */}
                  {comments
                    .slice(0, showAllComments ? comments.length : 5)
                    .map((comment) => (
                    <div key={comment.id} className="p-4 rounded-xl bg-white/5 dark:bg-white/5 [data-theme='light']:bg-slate-50 border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-200 backdrop-blur-sm hover:bg-white/10 dark:hover:bg-white/10 [data-theme='light']:hover:bg-slate-100 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-medium text-white dark:text-white [data-theme='light']:text-foreground font-sans">{comment.author}</span>
                            <span className="text-xs text-zinc-400 font-mono">
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-white dark:text-white [data-theme='light']:text-slate-800 leading-relaxed font-sans">{comment.content}</p>
                        </div>
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 border ml-4 backdrop-blur-sm ${
                            comment.liked
                              ? 'text-rose-400 bg-rose-500/20 border-rose-500/50'
                              : 'text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 border-white/10'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill={comment.liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          <span className="font-medium font-mono">{comment.likes}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* 展开/收起按钮 */}
                  {comments.length > 5 && (
                    <div className="text-center pt-4">
                      <button
                        onClick={() => setShowAllComments(!showAllComments)}
                        className="px-4 py-2 text-sm text-zinc-300 border border-white/10 rounded-xl hover:bg-white/10 transition-all font-sans backdrop-blur-sm"
                      >
                        {showAllComments ? '收起评论' : `展开全部 ${comments.length} 条评论`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ASR Transcript - Compact Style */}
          {podcast.originalTranscript && (
            <div className="mt-6 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 shadow-sm">
              {/* Header: Compact header */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-black/40 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500/60"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500/60"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500/60"></div>
                  </div>
                  <h2 className="text-xs font-mono text-slate-600 dark:text-zinc-300">ASR Transcript</h2>
                  {/* 翻译切换按钮（仅当有翻译时显示） */}
                  {podcast.translatedTranscript && (
                    <button
                      onClick={() => setIsEnglishOriginal(!isEnglishOriginal)}
                      className="ml-2 px-2 py-0.5 text-xs font-mono border border-slate-200 dark:border-white/10 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 transition-colors"
                      title={isEnglishOriginal ? '切换到中文翻译' : '切换到英文原文'}
                    >
                      {isEnglishOriginal ? 'EN' : '中'}
                    </button>
                  )}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setShowASR(!showASR)}
                    className="px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors font-mono"
                  >
                    {showASR ? '收起' : '展开全文'}
                  </button>
                )}
              </div>
              {/* Body: Terminal-style content */}
              {isEditing ? (
                <div className="p-4">
                  <label className="block text-xs font-medium text-zinc-500 mb-2 font-mono">ASR原文内容</label>
                  <textarea
                    value={editData.script}
                    onChange={(e) => setEditData({ ...editData, script: e.target.value })}
                    className="w-full p-4 border border-white/5 dark:border-white/5 [data-theme='light']:border-slate-200 rounded-lg bg-black/60 dark:bg-black/60 [data-theme='light']:bg-white text-white dark:text-white [data-theme='light']:text-foreground focus:outline-none focus:border-white/10 dark:focus:border-white/10 [data-theme='light']:focus:border-slate-300 font-mono text-sm leading-relaxed"
                    rows={20}
                    placeholder="请输入ASR原文内容..."
                  />
                </div>
              ) : (
                showASR ? (
                  <div 
                    className="p-6 font-mono text-sm overflow-y-auto relative bg-white dark:bg-black/40 text-slate-900 dark:text-zinc-200"
                    style={{ 
                      height: '400px', 
                      wordWrap: 'break-word', 
                      overflowWrap: 'break-word',
                      lineHeight: '1.8',
                      whiteSpace: 'pre-wrap'
                    }}
                    onWheel={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <div className="flex items-center justify-end gap-2 mb-4 pb-2 border-b border-slate-200 dark:border-white/10">
                      <button
                        onClick={() => handleCopy(
                          isEnglishOriginal && podcast.translatedTranscript
                            ? podcast.originalTranscript || ''
                            : (podcast.translatedTranscript || podcast.originalTranscript || ''),
                          'ASR原文'
                        )}
                        className="px-2 py-1 text-xs text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-white/10 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors font-mono"
                        title="复制ASR原文"
                      >
                        复制
                      </button>
                      <button
                        onClick={() => setShowFullscreenScript(true)}
                        className={`px-2 py-1 text-xs ${accentStyle.text} border ${accentStyle.border} rounded hover:${accentStyle.bg} transition-colors font-mono`}
                      >
                        全屏
                      </button>
                    </div>
                    <span className="text-slate-400 dark:text-zinc-500">$ </span>
                    {isEnglishOriginal && podcast.translatedTranscript
                      ? podcast.originalTranscript  // 显示英文原文
                      : (podcast.translatedTranscript || podcast.originalTranscript)  // 默认显示中文翻译，如果没有翻译则显示原文
                    }
                    {/* 内容受限遮罩 */}
                    {isContentLimited && (
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black/90 backdrop-blur-sm flex items-end justify-center pb-8 pointer-events-auto">
                        <div className="bg-zinc-900/95 dark:bg-zinc-900/95 [data-theme='light']:bg-white/95 border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
                          <div className="text-center mb-4">
                            <div className="text-3xl mb-3">🔒</div>
                            <h3 className="text-lg font-bold text-white dark:text-white [data-theme='light']:text-foreground mb-2">
                              今日查看次数已用完
                            </h3>
                            <p className="text-sm text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 mb-4">
                              您今天已经查看了 {visitorLimitInfo?.count || 3} 个播客详情。
                              <br />
                              注册登录后可无限浏览所有播客！
                            </p>
                          </div>
                          <div className="space-y-3">
                            <Link
                              href="/register"
                              className="block w-full px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-zinc-200 transition-colors text-center"
                            >
                              立即注册
                            </Link>
                            <Link
                              href="/login"
                              className="visitor-login-btn block w-full px-6 py-3 bg-zinc-800 dark:bg-zinc-800 [data-theme='light']:bg-slate-900 text-white dark:text-white border border-white/10 rounded-lg font-bold hover:bg-zinc-700 dark:hover:bg-zinc-700 [data-theme='light']:hover:bg-slate-800 transition-colors text-center"
                            >
                              登录
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null
              )}
            </div>
          )}
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


      {/* 全屏播客总结模态框 */}
      {showFullscreenReport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className={`text-2xl font-bold font-sans ${accentStyle.text}`}>Insight</h2>
              <div className="flex items-center gap-3">
                <button
                    onClick={() => handleCopy(podcast.summary || '', 'Insight')}
                  className="text-sm text-zinc-400 hover:text-zinc-300 px-3 py-1.5 border border-white/5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1 font-mono"
                  title="复制全文"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制
                </button>
                <button
                  onClick={() => setShowFullscreenReport(false)}
                  className="text-zinc-400 hover:text-white text-2xl transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-invert prose-lg max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="text-zinc-300 text-base leading-7 mb-4 font-sans">
                        {children}
                      </p>
                    ),
                    li: ({ children }) => (
                      <li className="text-zinc-300 text-base leading-7 mb-2 font-sans">
                        {children}
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong className="text-white font-semibold">
                        {children}
                      </strong>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-white text-2xl font-bold mb-5 mt-6 font-sans">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-white text-xl font-bold mb-4 mt-5 font-sans">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-white text-lg font-bold mb-3 mt-4 font-sans">
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

      {/* 全屏ASR原文模态框（原"访谈全文"模态框，清洗稿已移除） */}
      {showFullscreenScript && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className={`text-2xl font-bold font-sans ${accentStyle.text}`}>ASR原文</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleCopy(podcast.originalTranscript || '', 'ASR原文')}
                  className="text-sm text-zinc-400 hover:text-zinc-300 px-3 py-1.5 border border-white/5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1 font-mono"
                  title="复制ASR原文"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制
                </button>
                <button
                  onClick={() => setShowFullscreenScript(false)}
                  className="text-zinc-400 hover:text-white text-2xl transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed font-mono">
                {podcast.originalTranscript || '暂无ASR原文'}
              </div>
            </div>
          </div>
        </div>
      )}

      <VisitorLimitModal
        isOpen={showVisitorLimitModal}
        onClose={() => setShowVisitorLimitModal(false)}
        count={visitorLimitInfo?.count || 3}
        limit={visitorLimitInfo?.limit || 3}
      />
    </div>
  );
}
