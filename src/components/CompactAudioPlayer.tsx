"use client";

import { useState, useRef, useEffect } from 'react';
import AudioWaveform from './AudioWaveform';
import { getStyleFromTitle } from '@/utils/podcast-styles';

interface CompactAudioPlayerProps {
  audioUrl: string;
  title?: string;
}

export default function CompactAudioPlayer({ audioUrl, title = '' }: CompactAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const accentStyle = getStyleFromTitle(title);

  // 更新当前时间
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  // 更新播放速度
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressRef.current;
    if (!audio || !progressBar || !duration) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* 播放/暂停按钮 - 带渐变边框 */}
      <div 
        className="flex-shrink-0 w-10 h-10 rounded-full p-[2px]"
        style={{
          background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #f43f5e)'
        }}
      >
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className={`
            w-full h-full rounded-full
            flex items-center justify-center
            bg-black
            text-white
            hover:bg-zinc-900
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* 简化进度条 */}
      <div className="flex-1 relative">
        <div 
          ref={progressRef}
          onClick={handleProgressClick}
          className="relative w-full h-1 cursor-pointer rounded-full overflow-hidden bg-white/5"
        >
          <div 
            className="absolute left-0 top-0 h-full bg-indigo-400 transition-all duration-100 rounded-full"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        {/* 时间显示 */}
        <div className="flex justify-between items-center mt-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-500 [data-theme='light']:text-slate-700">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 倍速选择 - 简洁样式 */}
      <div className="flex-shrink-0">
        <select
          value={playbackRate}
          onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
          className="px-2 py-0.5 text-xs bg-transparent text-zinc-400 dark:text-zinc-400 [data-theme='light']:text-slate-700 hover:text-zinc-300 dark:hover:text-zinc-300 [data-theme='light']:hover:text-slate-900 focus:outline-none cursor-pointer font-mono appearance-none pr-6 select-arrow-dark"
          disabled={isLoading}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0 center',
            backgroundSize: '10px'
          }}
        >
          <option value="0.5">0.5x</option>
          <option value="0.75">0.75x</option>
          <option value="1">1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>
    </div>
  );
}

