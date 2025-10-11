"use client";

interface AboutModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export function AboutModal({ isVisible, onClose }: AboutModalProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-white border-2 border-gray-800 p-8 max-w-md mx-4 shadow-2xl pointer-events-auto rounded-lg">
        {/* 标题 */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
            关于 PodHome
          </h3>
        </div>
        
        {/* 内容 */}
        <div className="text-sm leading-relaxed space-y-3 text-gray-700">
          <p>本应用纯用于内部学习与研究，内容来源于公开播客，不应用于商业用途。</p>
          <p>如有侵权，请联系删除。</p>
          <p>关于 AI 相关产品，欢迎交流。</p>
          <div className="pt-2">
            <span className="text-gray-600">微信：</span>
            <span className="font-medium text-gray-900">njumwh</span>
          </div>
        </div>
        
        {/* 关闭按钮 */}
        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
