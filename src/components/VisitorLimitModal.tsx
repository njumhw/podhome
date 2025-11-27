"use client";

import { useRouter } from 'next/navigation';

interface VisitorLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  limit: number;
}

export default function VisitorLimitModal({ isOpen, onClose, count, limit }: VisitorLimitModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">今日查看次数已用完</h2>
          <p className="text-gray-400 text-sm">
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
            className="w-full px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-zinc-200 transition-colors"
          >
            立即注册
          </button>
          <button
            onClick={() => {
              router.push('/login');
              onClose();
            }}
            className="w-full px-6 py-3 bg-zinc-800 text-white border border-white/10 rounded-lg font-bold hover:bg-zinc-700 transition-colors"
          >
            登录
          </button>
          <button
            onClick={onClose}
            className="w-full px-6 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

