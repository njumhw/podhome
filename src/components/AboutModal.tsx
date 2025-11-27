"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface AboutModalProps {
  isVisible: boolean;
  onClose: () => void;
}

type TabType = 'about' | 'permissions';

export function AboutModal({ isVisible, onClose }: AboutModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('about');

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
      <div className="relative bg-white dark:bg-zinc-900 border-2 border-gray-300 dark:border-white/10 p-8 w-full max-w-2xl mx-4 shadow-2xl pointer-events-auto rounded-lg z-10 about-modal">
        {/* 标题 */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/10 pb-2">
            关于 Podcast to Insight
          </h3>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-white/10">
          <button
            onClick={() => setActiveTab('about')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'about'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
            }`}
          >
            关于我们
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'permissions'
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
            }`}
          >
            用户权限说明
          </button>
        </div>
        
        {/* 内容区域 - 固定高度 */}
        <div className="min-h-[320px]">
          {activeTab === 'about' && (
            <div className="text-sm leading-relaxed space-y-4 text-gray-700 dark:text-zinc-300">
              {/* 第一段落：正常颜色 */}
              <div className="space-y-2">
                <p>0代码基础，纯vibecoding产品，如有BUG还请多多包涵。</p>
                <p>暂无任何商业模式，让我们一起为爱发电。</p>
                <p>全程使用阿里云服务（等一个广告费）。</p>
              </div>
              
              {/* 第二段落：字体加粗 */}
              <div className="pt-2">
                <p className="font-bold text-gray-900 dark:text-white">
                  欢迎交流更多AI产品——钉钉【阿茅】 微信【njumwh】
                </p>
              </div>
              
              {/* 第三段落：灰色，字体变小 */}
              <div className="pt-2 space-y-1 text-xs text-gray-500 dark:text-zinc-500">
                <p>本产品纯应用于内部学习与研究，内容来源于公开播客。</p>
                <p>如有侵权，请联系删除。</p>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="text-sm text-gray-700 dark:text-zinc-300">
              {/* 身份获得方式说明 */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-white/10">
                <p className="text-xs text-gray-600 dark:text-zinc-400 space-y-1">
                  <span className="font-medium text-gray-900 dark:text-white">Visitor：</span>无需注册登录，直接访问即可
                  <br />
                  <span className="font-medium text-gray-900 dark:text-white">Reader：</span>注册登录即可获得（无需邀请码）
                  <br />
                  <span className="font-medium text-gray-900 dark:text-white">Podcaster：</span>Reader 用户通过邀请码升级获得
                  <span className="text-gray-500 dark:text-zinc-500">（钉钉联系【阿茅】或微信添加【njumwh】获取邀请码）</span>
                </p>
              </div>

              {/* 权限对比表格 */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300 dark:border-white/20">
                      <th className="text-left py-2 px-3 font-semibold text-gray-900 dark:text-white">功能权限</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-900 dark:text-white">Visitor</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-900 dark:text-white">Reader</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-900 dark:text-white">Podcaster</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200 dark:border-white/10">
                      <td className="py-2 px-3 text-gray-700 dark:text-zinc-300">搜索与浏览</td>
                      <td className="py-2 px-3 text-center text-gray-900 dark:text-white">✓</td>
                      <td className="py-2 px-3 text-center text-gray-900 dark:text-white">✓</td>
                      <td className="py-2 px-3 text-center text-gray-900 dark:text-white">✓</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-white/10">
                      <td className="py-2 px-3 text-gray-700 dark:text-zinc-300">查看播客详情</td>
                      <td className="py-2 px-3 text-center text-gray-600 dark:text-zinc-400">3次/天</td>
                      <td className="py-2 px-3 text-center text-gray-900 dark:text-white">✓</td>
                      <td className="py-2 px-3 text-center text-gray-900 dark:text-white">✓</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-white/10">
                      <td className="py-2 px-3 text-gray-700 dark:text-zinc-300">点赞、评论、收藏</td>
                      <td className="py-2 px-3 text-center text-gray-500 dark:text-zinc-500">/</td>
                      <td className="py-2 px-3 text-center text-gray-900 dark:text-white">✓</td>
                      <td className="py-2 px-3 text-center text-gray-900 dark:text-white">✓</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-white/10">
                      <td className="py-2 px-3 text-gray-700 dark:text-zinc-300">上传播客</td>
                      <td className="py-2 px-3 text-center text-gray-500 dark:text-zinc-500">/</td>
                      <td className="py-2 px-3 text-center text-gray-500 dark:text-zinc-500">/</td>
                      <td className="py-2 px-3 text-center text-gray-600 dark:text-zinc-400">2次/天</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
