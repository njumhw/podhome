"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface AboutModalProps {
  isVisible: boolean;
  onClose: () => void;
  initialTab?: 'about' | 'permissions';
}

type TabType = 'about' | 'permissions';

export function AboutModal({ isVisible, onClose, initialTab = 'about' }: AboutModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // 当弹窗打开或initialTab变化时，更新activeTab
  useEffect(() => {
    if (isVisible) {
      setActiveTab(initialTab);
    }
  }, [isVisible, initialTab]);

  // 当弹窗关闭时，重置为默认标签页（可选，保持当前标签页也可以）
  // useEffect(() => {
  //   if (!isVisible) {
  //     setActiveTab('about');
  //   }
  // }, [isVisible]);

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
        className="absolute inset-0 bg-black/70 dark:bg-black/70 [data-theme='light']:bg-black/50 backdrop-blur-md pointer-events-auto"
        onClick={onClose}
      ></div>
      
      {/* 弹窗内容 - 与应用风格一致 */}
      <div className="about-modal relative bg-[#0f0f0f] dark:bg-[#0f0f0f] [data-theme='light']:bg-white border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 p-8 w-full max-w-3xl mx-4 shadow-2xl pointer-events-auto rounded-lg z-10 backdrop-blur-sm">
        {/* 标题 - 使用应用风格 */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white dark:text-white [data-theme='light']:text-slate-900 font-sans flex items-center gap-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffd48f] via-[#ff9f43] to-[#ff6a00]">
              Podcast to Insight
            </span>
          </h3>
          <div className="mt-2 h-px bg-gradient-to-r from-white/20 via-white/10 to-transparent [data-theme='light']:bg-gradient-to-r [data-theme='light']:from-slate-300 [data-theme='light']:via-slate-200 [data-theme='light']:to-transparent"></div>
        </div>

        {/* Tab 切换 - 现代化设计 */}
        <div className="flex gap-2 mb-6 border-b border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300">
          <button
            onClick={() => setActiveTab('about')}
            className={`px-4 py-2 text-sm font-mono transition-all relative ${
              activeTab === 'about'
                ? 'text-white dark:text-white [data-theme="light"]:text-slate-900'
                : 'text-white/60 dark:text-white/60 [data-theme="light"]:text-slate-600 hover:text-white/80 dark:hover:text-white/80 [data-theme="light"]:hover:text-slate-800'
            }`}
          >
            关于我们
            {activeTab === 'about' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#ff9f43] to-[#ff6a00]"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-4 py-2 text-sm font-mono transition-all relative ${
              activeTab === 'permissions'
                ? 'text-white dark:text-white [data-theme="light"]:text-slate-900'
                : 'text-white/60 dark:text-white/60 [data-theme="light"]:text-slate-600 hover:text-white/80 dark:hover:text-white/80 [data-theme="light"]:hover:text-slate-800'
            }`}
          >
            用户权限说明
            {activeTab === 'permissions' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#ff9f43] to-[#ff6a00]"></div>
            )}
          </button>
        </div>
        
        {/* 内容区域 */}
        <div className="min-h-[360px] max-h-[60vh] overflow-y-auto pr-2">
          {activeTab === 'about' && (
            <div className="text-sm leading-relaxed space-y-4 font-sans about-modal-content">
              {/* 第一段落 */}
              <div className="space-y-3">
                <p className="about-modal-text">
                  0代码基础，纯vibecoding产品，如有BUG还请多多包涵。
                </p>
                <p className="about-modal-text">
                  暂无任何商业模式，让我们一起为爱发电。
                </p>
                <p className="about-modal-text">
                  全程使用阿里云服务（等一个广告费）。
                </p>
              </div>
              
              {/* 第二段落：强调 */}
              <div className="pt-4 border-t border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300">
                <p className="about-modal-emphasis">
                  欢迎交流更多AI产品——钉钉【阿茅】 微信【njumwh】
                </p>
              </div>
              
              {/* 第三段落：小字灰色 */}
              <div className="pt-4 space-y-1 text-xs font-mono about-modal-small">
                <p>本产品纯应用于内部学习与研究，内容来源于公开播客。</p>
                <p>如有侵权，请联系删除。</p>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="text-sm text-white/90 dark:text-white/90 [data-theme='light']:text-foreground">
              {/* 身份获得方式说明 - 卡片样式 */}
              <div className="mb-6 p-4 bg-black/40 dark:bg-black/40 [data-theme='light']:bg-slate-50 rounded-lg border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 backdrop-blur-sm">
                <p className="text-xs text-white/70 dark:text-white/70 [data-theme='light']:text-slate-700 font-mono space-y-2 leading-relaxed">
                  <span>
                    <span className="font-semibold text-white dark:text-white [data-theme='light']:text-slate-900">Visitor：</span>
                    无需注册登录，直接访问即可
                  </span>
                  <br />
                  <span>
                    <span className="font-semibold text-white dark:text-white [data-theme='light']:text-slate-900">Reader：</span>
                    注册登录即可获得（无需邀请码）
                  </span>
                  <br />
                  <span>
                    <span className="font-semibold text-white dark:text-white [data-theme='light']:text-slate-900">Podcaster：</span>
                    Reader 用户通过邀请码升级获得
                    <span className="text-white/50 dark:text-white/50 [data-theme='light']:text-slate-600">（钉钉联系【阿茅】或微信添加【njumwh】获取邀请码）</span>
                  </span>
                </p>
              </div>

              {/* 权限对比表格 - 现代化设计 */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm font-mono">
                  <thead>
                    <tr className="border-b border-white/20 dark:border-white/20 [data-theme='light']:border-slate-400">
                      <th className="text-left py-3 px-4 font-semibold text-white dark:text-white [data-theme='light']:text-slate-900">功能权限</th>
                      <th className="text-center py-3 px-4 font-semibold text-white dark:text-white [data-theme='light']:text-slate-900">Visitor</th>
                      <th className="text-center py-3 px-4 font-semibold text-white dark:text-white [data-theme='light']:text-slate-900">Reader</th>
                      <th className="text-center py-3 px-4 font-semibold text-white dark:text-white [data-theme='light']:text-slate-900">Podcaster</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-100 transition-colors">
                      <td className="py-3 px-4 text-white/80 dark:text-white/80 [data-theme='light']:text-slate-800">搜索与浏览</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[#10b981] font-bold">✓</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[#10b981] font-bold">✓</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[#10b981] font-bold">✓</span>
                      </td>
                    </tr>
                    <tr className="border-b border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-100 transition-colors">
                      <td className="py-3 px-4 text-white/80 dark:text-white/80 [data-theme='light']:text-slate-800">查看播客详情</td>
                      <td className="py-3 px-4 text-center text-white/60 dark:text-white/60 [data-theme='light']:text-slate-700">3次/天</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[#10b981] font-bold">✓</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[#10b981] font-bold">✓</span>
                      </td>
                    </tr>
                    <tr className="border-b border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-100 transition-colors">
                      <td className="py-3 px-4 text-white/80 dark:text-white/80 [data-theme='light']:text-slate-800">点赞、评论、收藏</td>
                      <td className="py-3 px-4 text-center text-white/40 dark:text-white/40 [data-theme='light']:text-slate-500">/</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[#10b981] font-bold">✓</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[#10b981] font-bold">✓</span>
                      </td>
                    </tr>
                    <tr className="border-b border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 hover:bg-white/5 dark:hover:bg-white/5 [data-theme='light']:hover:bg-slate-100 transition-colors">
                      <td className="py-3 px-4 text-white/80 dark:text-white/80 [data-theme='light']:text-slate-800">上传播客</td>
                      <td className="py-3 px-4 text-center text-white/40 dark:text-white/40 [data-theme='light']:text-slate-500">/</td>
                      <td className="py-3 px-4 text-center text-white/40 dark:text-white/40 [data-theme='light']:text-slate-500">/</td>
                              <td className="py-3 px-4 text-center text-white/60 dark:text-white/60 [data-theme='light']:text-slate-700">1次/天</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        {/* 关闭按钮 - 与应用风格一致 */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-zinc-900/60 dark:bg-zinc-900/60 [data-theme='light']:bg-slate-200 backdrop-blur-sm border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-300 hover:border-white/20 dark:hover:border-white/20 [data-theme='light']:hover:border-slate-400 hover:bg-zinc-900/80 dark:hover:bg-zinc-900/80 [data-theme='light']:hover:bg-slate-300 text-white dark:text-white [data-theme='light']:text-slate-900 rounded-lg transition-all font-mono text-sm active:scale-95"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
