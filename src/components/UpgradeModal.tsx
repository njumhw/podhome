"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleUpgrade = async () => {
    if (!inviteCode.trim()) {
      setError('请输入邀请码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
        credentials: "include", // 确保发送 Cookie
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '升级失败');
      }

      // 升级成功，刷新页面
      window.location.reload();
    } catch (err: any) {
      setError(err.message || '升级失败，请检查邀请码是否正确');
    } finally {
      setIsLoading(false);
    }
  };

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
        className="absolute inset-0 bg-black/70 dark:bg-black/70 [data-theme='light']:bg-black/50 backdrop-blur-md pointer-events-auto"
        onClick={onClose}
      ></div>
      
      {/* 弹窗内容 */}
      <div className="upgrade-modal relative bg-zinc-900 dark:bg-zinc-900 [data-theme='light']:bg-white border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl pointer-events-auto z-10">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="upgrade-modal-title text-2xl font-bold text-white dark:text-white [data-theme='light']:text-slate-900 mb-2">需要 Podcaster 权限</h2>
          <p className="upgrade-modal-text text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-700 text-sm leading-relaxed space-y-2">
            算力成本实在不低，而这个产品目前纯为爱发电，
            <br className="hidden sm:block" />
            所以上传功能暂时只对 Podcaster 开放。
            <span className="block">
              请先获取邀请码并完成验证，再升级为 Podcaster。
            </span>
            <span className="block mt-3 text-[13px] text-gray-200 dark:text-gray-200 [data-theme='light']:text-slate-800 font-medium">
              获取邀请码：
              <span className="block text-base text-white dark:text-white [data-theme='light']:text-slate-900 mt-1">
                钉钉联系【阿茅】 / 微信添加【njumwh】
              </span>
            </span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="upgrade-modal-label block text-sm font-medium text-gray-300 dark:text-gray-300 [data-theme='light']:text-slate-700 mb-2">
              邀请码
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="请输入邀请码"
              className="w-full px-4 py-3 bg-zinc-800 dark:bg-zinc-800 [data-theme='light']:bg-slate-100 border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 rounded-lg text-white dark:text-white [data-theme='light']:text-slate-900 placeholder-gray-500 dark:placeholder-gray-500 [data-theme='light']:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/20 dark:focus:ring-white/20 [data-theme='light']:focus:ring-slate-400"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 dark:text-red-400 [data-theme='light']:text-red-600 bg-red-900/20 dark:bg-red-900/20 [data-theme='light']:bg-red-50 border border-red-500/30 dark:border-red-500/30 [data-theme='light']:border-red-300 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={handleUpgrade}
              disabled={isLoading || !inviteCode.trim()}
              className="w-full px-6 py-3 bg-white dark:bg-white [data-theme='light']:bg-slate-900 text-black dark:text-black [data-theme='light']:text-white rounded-lg font-bold hover:bg-zinc-200 dark:hover:bg-zinc-200 [data-theme='light']:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '升级中...' : '升级'}
            </button>
            <button
              onClick={onClose}
              className="upgrade-modal-cancel w-full px-6 py-2 text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 hover:text-white dark:hover:text-white [data-theme='light']:hover:text-slate-900 transition-colors text-sm"
              disabled={isLoading}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

