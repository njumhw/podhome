"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@/hooks/useUser";

interface UserMenuProps {
  onAboutClick: () => void;
  onPermissionsClick: () => void;
  onLogout: () => void;
}

// 角色配置（从 UserStatusBadge 复制）
const roleConfig: Record<'visitor' | 'reader' | 'podcaster' | 'vip' | 'admin', { label: string; color: string; borderColor: string }> = {
  visitor: {
    label: 'VISITOR',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-400/40',
  },
  reader: {
    label: 'READER',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-400/40',
  },
  podcaster: {
    label: 'PODCASTER',
    color: 'text-fuchsia-500',
    borderColor: 'border-fuchsia-500/40',
  },
  vip: {
    label: 'VIP',
    color: 'text-amber-400',
    borderColor: 'border-amber-400/40',
  },
  admin: {
    label: 'ADMIN',
    color: 'text-rose-500',
    borderColor: 'border-rose-500/40',
  },
};

export function UserMenu({ onAboutClick, onPermissionsClick, onLogout }: UserMenuProps) {
  const { user, dailyUsage } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // 映射用户角色
  const getBadgeRole = (): 'visitor' | 'reader' | 'podcaster' | 'vip' | 'admin' => {
    if (!user) return 'visitor';
    if (user.role === 'ADMIN') return 'admin';
    if (user.role === 'PODCASTER_VIP') return 'vip';
    if (user.role === 'PODCASTER' || user.role === 'USER') return 'podcaster';
    if (user.role === 'READER') return 'reader';
    return 'visitor';
  };

  const badgeRole = getBadgeRole();
  const badgeConfig = roleConfig[badgeRole];

  return (
    <div className="relative" ref={menuRef}>
      {/* 用户菜单按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-transparent hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-100 border border-transparent hover:border-white/10 dark:hover:border-white/10 [data-theme='light']:hover:border-slate-300 transition-all cursor-pointer"
      >
        {/* 用户状态徽章 - 使用 div 而不是 button，避免嵌套按钮 */}
        <div
          className={`
            inline-flex items-center justify-center
            px-3 py-1.5
            bg-black/40 dark:bg-black/40 [data-theme='light']:bg-slate-100
            border ${badgeConfig.borderColor}
            rounded
            font-mono text-xs font-semibold uppercase tracking-wider
            ${badgeConfig.color}
          `}
        >
          {badgeConfig.label}
        </div>
        
        {/* 用户名或访客标识 */}
        {user ? (
          <span className="text-sm text-white dark:text-white [data-theme='light']:text-slate-900 font-medium">
            {user.username}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 font-mono">
            访客
          </span>
        )}
        
        {/* 下拉箭头 */}
        <svg 
          className={`w-4 h-4 text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg bg-[#0f0f0f] dark:bg-[#0f0f0f] [data-theme='light']:bg-white border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 shadow-xl z-50 overflow-hidden">
          {/* 用户信息区域 */}
          <div className="px-4 py-3 border-b border-white/10 dark:border-white/10 [data-theme='light']:border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              {/* 用户状态徽章 - 使用 div 而不是 button */}
              <div
                className={`
                  inline-flex items-center justify-center
                  px-3 py-1.5
                  bg-black/40 dark:bg-black/40 [data-theme='light']:bg-slate-100
                  border ${badgeConfig.borderColor}
                  rounded
                  font-mono text-xs font-semibold uppercase tracking-wider
                  ${badgeConfig.color}
                `}
              >
                {badgeConfig.label}
              </div>
            </div>
            {user && (
              <>
                <div className="text-sm text-white dark:text-white [data-theme='light']:text-slate-900 font-medium mb-1">
                  {user.username}
                </div>
                {/* 今日额度 */}
                {(dailyUsage.limit > 0 || dailyUsage.limit === -1) && (
                  <div className="text-xs text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 font-mono">
                    今日额度：{dailyUsage.used}{dailyUsage.limit === -1 ? '/∞' : `/${dailyUsage.limit}`}
                  </div>
                )}
              </>
            )}
            {!user && (
              <div className="text-sm text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 font-mono">
                未登录
              </div>
            )}
          </div>

          {/* 菜单项 */}
          <div className="py-1">
            <button
              onClick={() => {
                onAboutClick();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 dark:text-gray-300 [data-theme='light']:text-slate-700 hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-50 transition-colors font-mono flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              关于我们
            </button>
            
            <button
              onClick={() => {
                onPermissionsClick();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-300 dark:text-gray-300 [data-theme='light']:text-slate-700 hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-50 transition-colors font-mono flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              用户权限说明
            </button>

            {user ? (
              <>
                <div className="my-1 h-px bg-white/10 dark:bg-white/10 [data-theme='light']:bg-slate-200"></div>
                <button
                  onClick={() => {
                    onLogout();
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 dark:text-red-400 [data-theme='light']:text-red-600 hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-red-50 transition-colors font-mono flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  退出
                </button>
              </>
            ) : (
              <>
                <div className="my-1 h-px bg-white/10 dark:bg-white/10 [data-theme='light']:bg-slate-200"></div>
                <a
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-300 dark:text-gray-300 [data-theme='light']:text-slate-700 hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-50 transition-colors font-mono flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  登录
                </a>
                <a
                  href="/register"
                  onClick={() => setIsOpen(false)}
                  className="block w-full px-4 py-2 text-left text-sm text-blue-400 dark:text-blue-400 [data-theme='light']:text-blue-600 hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-blue-50 transition-colors font-mono flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  注册
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

