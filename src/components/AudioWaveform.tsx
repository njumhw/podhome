"use client";

import { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  accentColor?: string;
  className?: string;
}

export default function AudioWaveform({ 
  audioRef, 
  isPlaying, 
  accentColor = 'blue',
  className = '' 
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const barsRef = useRef<number[]>([]);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const audio = audioRef.current;
    if (!audio) return;

    // 只在首次初始化条形数据
    if (!isInitializedRef.current) {
      const barCount = 50;
      barsRef.current = Array.from({ length: barCount }, () => Math.random() * 0.3 + 0.1);
      isInitializedRef.current = true;
    }

    const barCount = barsRef.current.length;

    const draw = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = canvas.width / barCount;
      const maxHeight = canvas.height;

      barsRef.current.forEach((height, index) => {
        const x = index * barWidth;
        const barHeight = height * maxHeight;
        const y = (maxHeight - barHeight) / 2;

        // 根据播放状态调整颜色和高度
        if (isPlaying) {
          // 播放时：动态高度 + 霓虹色
          const dynamicHeight = height * (0.7 + Math.random() * 0.3);
          const finalHeight = dynamicHeight * maxHeight;
          const finalY = (maxHeight - finalHeight) / 2;

          // 渐变填充
          const gradient = ctx.createLinearGradient(x, 0, x + barWidth, 0);
          gradient.addColorStop(0, `rgba(59, 130, 246, 0.3)`); // blue-500
          gradient.addColorStop(0.5, `rgba(147, 51, 234, 0.5)`); // purple-600
          gradient.addColorStop(1, `rgba(16, 185, 129, 0.3)`); // emerald-500

          ctx.fillStyle = gradient;
          ctx.fillRect(x, finalY, barWidth - 1, finalHeight);
          
          // 添加发光效果
          ctx.shadowBlur = 4;
          ctx.shadowColor = `rgba(59, 130, 246, 0.5)`;
        } else {
          // 暂停时：静态高度 + 低透明度
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.shadowBlur = 0;
          ctx.fillRect(x, y, barWidth - 1, barHeight);
        }
      });

      if (isPlaying) {
        // 更新条形高度（模拟音频波形）- 直接更新 ref，不触发重新渲染
        barsRef.current = barsRef.current.map(h => {
          const change = (Math.random() - 0.5) * 0.1;
          return Math.max(0.1, Math.min(0.9, h + change));
        });
      }
    };

    const animate = () => {
      draw();
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animate();
    } else {
      draw();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioRef, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={40}
      className={`${className} rounded`}
    />
  );
}

