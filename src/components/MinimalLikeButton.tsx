'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';

interface MinimalLikeButtonProps {
  podcastId: string;
  initialLikeCount?: number;
  initialLiked?: boolean;
  className?: string;
  disableInitialFetch?: boolean;
  onStatusChange?: (liked: boolean, likeCount: number) => void;
  onRequireLogin?: () => void;
  // 外部状态同步：当这些值变化时，会更新内部状态
  externalLiked?: boolean;
  externalLikeCount?: number;
}

export default function MinimalLikeButton({ 
  podcastId, 
  initialLikeCount = 0, 
  initialLiked = false,
  className = '',
  disableInitialFetch = false,
  onStatusChange,
  onRequireLogin,
  externalLiked,
  externalLikeCount,
}: MinimalLikeButtonProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  // 同步外部状态：当 externalLiked 或 externalLikeCount 变化时，更新内部状态
  useEffect(() => {
    if (externalLiked !== undefined) {
      setLiked(externalLiked);
    }
    if (externalLikeCount !== undefined) {
      setLikeCount(externalLikeCount);
    }
  }, [externalLiked, externalLikeCount]);

  // 获取点赞状态
  useEffect(() => {
    if (disableInitialFetch) return;

    const fetchLikeStatus = async () => {
      try {
        const response = await fetch(`/api/podcast/like?podcastId=${podcastId}`);
        if (response.ok) {
          const data = await response.json();
          setLikeCount(data.likeCount);
          setLiked(data.liked);
          onStatusChange?.(data.liked, data.likeCount);
        }
      } catch (error) {
        console.error('获取点赞状态失败:', error);
      }
    };

    fetchLikeStatus();
  }, [podcastId, disableInitialFetch, onStatusChange]);

  const handleLike = async () => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/podcast/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ podcastId }),
      });

      if (response.ok) {
        const data = await response.json();
        setLikeCount(data.likeCount);
        setLiked(data.liked);
        success(data.message);
        onStatusChange?.(data.liked, data.likeCount);
      } else {
        const errorData = await response.json();
        if (response.status === 401) {
          onRequireLogin?.();
        }
        error(errorData.error || '操作失败');
      }
    } catch (err) {
      console.error('点赞操作失败:', err);
      error('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      className={`group flex items-center gap-3 px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
        liked 
          ? 'border-transparent' 
          : 'border-transparent hover:bg-white/5'
      } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {/* Heart icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={liked ? '#000000' : 'none'}
        stroke={liked ? `url(#heart-gradient-border-${podcastId})` : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`w-[18px] h-[18px] transition-colors ${
          liked ? '' : 'text-zinc-500 group-hover:text-zinc-300'
        }`}
      >
        <defs>
          <linearGradient id={`heart-gradient-border-${podcastId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span className={`text-xs font-mono ${
        liked ? 'text-rose-400' : 'text-zinc-600 group-hover:text-zinc-400'
      }`}>
        {likeCount}
      </span>
    </button>
  );
}

