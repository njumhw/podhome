"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface AboutModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export function AboutModal({ isVisible, onClose }: AboutModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isVisible || !mounted) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center pointer-events-none" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        zIndex: 99999 
      }}
    >
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 dark:bg-black/60 [data-theme='light']:bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      ></div>
      
      {/* 弹窗内容 */}
      <div className="relative bg-white dark:bg-zinc-900 border-2 border-gray-300 dark:border-white/10 p-8 max-w-md mx-4 shadow-2xl pointer-events-auto rounded-lg z-10 about-modal">
        {/* 标题 */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/10 pb-2">
            关于 Podcast to Insight
          </h3>
        </div>
        
        {/* 内容 */}
        <div className="text-sm leading-relaxed space-y-3 text-gray-700 dark:text-zinc-300">
          <p>本应用纯用于内部学习与研究，内容来源于公开播客，不应用于商业用途。</p>
          <p>如有侵权，请联系删除。</p>
          <p>关于 AI 相关产品，欢迎交流。</p>
          <div className="pt-2">
            <span className="text-gray-600 dark:text-zinc-400">微信：</span>
            <span className="font-medium text-gray-900 dark:text-white">njumwh</span>
          </div>
        </div>
        
        {/* 关闭按钮 */}
        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="about-modal-btn px-4 py-2 text-sm rounded-md active:scale-95 transition-all font-sans font-medium shadow-sm"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
