"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface VisitorLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  limit: number;
}

export default function VisitorLimitModal({ isOpen, onClose, count, limit }: VisitorLimitModalProps) {
  const router = useRouter();
  const [loginTextColor, setLoginTextColor] = useState('rgb(255, 255, 255)');

  useEffect(() => {
    const updateColor = () => {
      const html = document.documentElement;
      const theme = html.getAttribute('data-theme');
      setLoginTextColor(theme === 'light' ? '#ffffff' : 'rgb(255, 255, 255)');
    };
    
    updateColor();
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class']
    });
    
    return () => observer.disconnect();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/60 [data-theme='light']:bg-black/40 backdrop-blur-sm">
      <div className="visitor-limit-modal bg-zinc-900 dark:bg-zinc-900 [data-theme='light']:bg-white border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="visitor-limit-title text-2xl font-bold text-white dark:text-white [data-theme='light']:text-slate-900 mb-2">今日查看次数已用完</h2>
          <p className="visitor-limit-text text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-700 text-sm">
            您今天已经查看了 {count} 个播客详情。
            <br />
            注册登录后可无限浏览所有播客！
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              router.push('/register');
              onClose();
            }}
            className="w-full px-6 py-3 bg-white dark:bg-white [data-theme='light']:bg-slate-900 text-black dark:text-black [data-theme='light']:text-white rounded-lg font-bold hover:bg-zinc-200 dark:hover:bg-zinc-200 [data-theme='light']:hover:bg-slate-800 transition-colors"
          >
            立即注册
          </button>
          <button
            onClick={() => {
              router.push('/login');
              onClose();
            }}
            className="visitor-login-btn w-full px-6 py-3 bg-zinc-800 dark:bg-zinc-800 [data-theme='light']:bg-slate-900 text-white dark:text-white [data-theme='light']:text-white rounded-lg font-bold hover:bg-zinc-700 dark:hover:bg-zinc-700 [data-theme='light']:hover:bg-slate-800 transition-colors"
          >
            登录
          </button>
          <button
            onClick={onClose}
            className="visitor-limit-cancel w-full px-6 py-2 text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-700 hover:text-white dark:hover:text-white [data-theme='light']:hover:text-slate-900 transition-colors text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

