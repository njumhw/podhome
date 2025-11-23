'use client';

import { useState, useEffect } from 'react';
import { useToast } from './Toast';

interface LikeButtonProps {
  podcastId: string;
  initialLikeCount?: number;
  initialLiked?: boolean;
  className?: string;
}

export default function LikeButton({ 
  podcastId, 
  initialLikeCount = 0, 
  initialLiked = false,
  className = ''
}: LikeButtonProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { success, error } = useToast();

  // 获取点赞状态
  useEffect(() => {
    const fetchLikeStatus = async () => {
      try {
        const response = await fetch(`/api/podcast/like?podcastId=${podcastId}`);
        if (response.ok) {
          const data = await response.json();
          setLikeCount(data.likeCount);
          setLiked(data.liked);
        }
      } catch (error) {
        console.error('获取点赞状态失败:', error);
      }
    };

    fetchLikeStatus();
  }, [podcastId]);

  const handleLike = async () => {
    if (loading) return;
    
    setLoading(true);
    setIsAnimating(true);
    
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
      } else {
        const errorData = await response.json();
        error(errorData.error || '操作失败');
      }
    } catch (err) {
      console.error('点赞操作失败:', err);
      error('网络错误，请重试');
    } finally {
      setLoading(false);
      // 动画结束后重置状态
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleLike}
        disabled={loading}
        aria-label={liked ? '取消点赞' : '点赞'}
        title={liked ? '已点赞' : '点赞'}
        className={`
          relative inline-flex items-center justify-center
          w-5 h-5
          transition-all duration-200 ease-out select-none
          ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-110 active:scale-95'}
          ${className}
        `}
      >
        {/* 爱心图标 */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={`w-5 h-5 transition-all duration-200 ${isAnimating ? 'scale-125' : ''}`}
          fill={liked ? 'url(#heart-gradient)' : 'none'}
          stroke={liked ? 'none' : '#9ca3af'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <defs>
            <linearGradient id="heart-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>
          <path 
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            className={liked ? 'drop-shadow-lg' : ''}
          />
        </svg>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </button>
      {/* 点赞数 */}
      <span className="text-sm text-zinc-400 font-sans">{likeCount}</span>
    </div>
  );
}
