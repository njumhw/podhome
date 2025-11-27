"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-2">需要 Podcaster 权限</h2>
          <p className="text-gray-400 text-sm leading-relaxed space-y-2">
            算力成本实在不低，而这个产品目前纯为爱发电，
            <br className="hidden sm:block" />
            所以上传功能暂时只对 Podcaster 开放。
            <span className="block">
              请先获取邀请码并完成验证，再升级为 Podcaster。
            </span>
            <span className="block mt-3 text-[13px] text-gray-200 font-medium">
              获取邀请码：
              <span className="block text-base text-white mt-1">
                钉钉联系【阿茅】 / 微信添加【njumwh】
              </span>
            </span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              邀请码
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="请输入邀请码"
              className="w-full px-4 py-3 bg-zinc-800 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-500/30 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={handleUpgrade}
              disabled={isLoading || !inviteCode.trim()}
              className="w-full px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '升级中...' : '升级'}
            </button>
            <button
              onClick={onClose}
              className="w-full px-6 py-2 text-gray-400 hover:text-white transition-colors text-sm"
              disabled={isLoading}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

