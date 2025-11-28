"use client";

import { useEffect, useRef } from 'react';

interface Dot {
  x: number;
  y: number;
  phase: number; // 0-1 的相位值，用于动画
  speed: number; // 动画速度
  maxOpacity: number; // 最大透明度
}

interface AnimatedDotGridProps {
  dotSize?: number; // 点的半径
  spacing?: number; // 点之间的间距
  activeDotRatio?: number; // 活跃点的比例（0-1）
  minCycleDuration?: number; // 最小动画周期（毫秒）
  maxCycleDuration?: number; // 最大动画周期（毫秒）
  className?: string;
}

export function AnimatedDotGrid({
  dotSize = 1.5,
  spacing = 24,
  activeDotRatio = 0.08, // 只有 8% 的点会闪烁，保持稀疏
  minCycleDuration = 3000, // 3秒
  maxCycleDuration = 8000, // 8秒
  className = '',
}: AnimatedDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const dotsRef = useRef<Dot[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // 获取当前主题
    const getTheme = () => {
      const html = document.documentElement;
      return html.getAttribute('data-theme') || (html.classList.contains('dark') ? 'dark' : 'light');
    };

    // 获取颜色
    const getColors = () => {
      const theme = getTheme();
      if (theme === 'light') {
        // 白色主题：默认点颜色与背景色 #f5f4f1 完全一致
        return {
          default: { r: 245, g: 244, b: 241, a: 1 }, // #f5f4f1 完全不透明
          active: { r: 255, g: 106, b: 0 }, // 品牌橙色 RGB
        };
      }
      // 深色主题：默认点颜色与背景色 #030207 完全一致
      return {
        default: { r: 3, g: 2, b: 7, a: 1 }, // #030207 完全不透明
        active: { r: 255, g: 106, b: 0 }, // 品牌橙色 RGB
      };
    };

    // 初始化点阵
    const initDots = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width || window.innerWidth;
      const height = rect.height || window.innerHeight;

      canvas.width = width;
      canvas.height = height;

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const totalDots = cols * rows;
      const activeCount = Math.floor(totalDots * activeDotRatio);

      dotsRef.current = [];
      const activeIndices = new Set<number>();

      // 随机选择活跃点
      while (activeIndices.size < activeCount) {
        activeIndices.add(Math.floor(Math.random() * totalDots));
      }

      let index = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const isActive = activeIndices.has(index);
          // 计算速度：每秒完成的周期数（1 / 周期时长（秒））
          const cycleDuration = minCycleDuration + Math.random() * (maxCycleDuration - minCycleDuration);
          const speed = 1 / (cycleDuration / 1000); // 转换为每秒的相位变化量
          
          dotsRef.current.push({
            x: col * spacing,
            y: row * spacing,
            phase: Math.random(), // 随机初始相位
            speed: speed, // 每秒的相位变化量
            maxOpacity: isActive ? 0.8 : 0, // 只有活跃点会发光
          });
          index++;
        }
      }
    };

    // 绘制点阵
    let lastTime = Date.now();
    const draw = () => {
      const colors = getColors();
      // 清空 Canvas（保持透明背景，不填充）
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 计算帧时间
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000; // 转换为秒
      lastTime = now;

      dotsRef.current.forEach((dot) => {
        // 更新相位（基于时间，而不是帧数，确保动画速度一致）
        dot.phase += dot.speed * deltaTime;
        if (dot.phase >= 1) {
          dot.phase = 0;
        }

        // 计算当前透明度（使用缓动函数实现呼吸效果）
        let activeOpacity = 0;
        const isActive = dot.maxOpacity > 0;
        
        if (isActive) {
          // 使用缓动函数让动画更自然（ease-in-out）
          const t = dot.phase;
          const easeInOut = t < 0.5 
            ? 2 * t * t 
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
          activeOpacity = easeInOut * dot.maxOpacity;
        }

        // 绘制点
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dotSize, 0, Math.PI * 2);
        
        if (isActive && activeOpacity > 0.05) {
          // 活跃点：使用品牌橙色，带透明度
          const { r, g, b } = colors.active;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${activeOpacity})`;
        } else {
          // 默认点：使用主题背景色，完全不透明（与背景色完全一致，完全不可见）
          const { r, g, b, a } = colors.default;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        
        ctx.fill();
      });
    };

    // 动画循环
    const animate = () => {
      draw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // 初始化
    initDots();
    draw();
    animate();

    // 窗口大小改变时重新初始化
    const handleResize = () => {
      initDots();
      draw();
    };

    window.addEventListener('resize', handleResize);

    // 清理
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dotSize, spacing, activeDotRatio, minCycleDuration, maxCycleDuration]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{ zIndex: -10 }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  );
}

