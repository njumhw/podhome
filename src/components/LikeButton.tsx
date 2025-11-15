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
    <button
      onClick={handleLike}
      disabled={loading}
      aria-label={liked ? '取消标记值得一读' : '标记值得一读'}
      title={liked ? '已标记' : '值得一读'}
      className={`
        relative inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px]
        border transition-all duration-150 ease-out select-none
        ${liked 
          ? 'bg-black text-white border-black hover:bg-black/90 active:scale-[0.98]'
          : 'bg-white text-gray-600 border-black hover:bg-gray-50 active:scale-[0.98]'
        }
        ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <span className="tracking-tight">值得一读</span>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-3 h-3 border border-current border-t-transparent rounded-full animate-spin ${liked ? 'text-white' : 'text-black'}`}></div>
        </div>
      )}
    </button>
  );
}
