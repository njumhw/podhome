"use client";

import { useState, useEffect } from 'react';

type ProcessingItem = {
  id: string;
  url: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  title?: string;
  startTime: number;
  error?: string;
};

interface ProcessingStatusProps {
  isVisible: boolean;
  onClose: () => void;
}

export function ProcessingStatus({ isVisible, onClose }: ProcessingStatusProps) {
  const [processingItems, setProcessingItems] = useState<ProcessingItem[]>([]);
  const [activeTab, setActiveTab] = useState<'processing' | 'completed'>('processing');

  useEffect(() => {
    if (isVisible) {
      // 从localStorage获取正在处理的播客
      const stored = localStorage.getItem('processingPodcasts');
      if (stored) {
        try {
          const items = JSON.parse(stored);
          setProcessingItems(items);
        } catch (error) {
          console.error('Failed to parse processing items:', error);
        }
      }
    }
  }, [isVisible]);

  // 添加进度更新逻辑
  useEffect(() => {
    if (!isVisible) return;

    const updateProgress = () => {
      // 首先从localStorage重新加载最新状态
      const stored = localStorage.getItem('processingPodcasts');
      if (stored) {
        try {
          const storedItems = JSON.parse(stored);
          setProcessingItems(storedItems);
        } catch (error) {
          console.error('Failed to parse stored items:', error);
        }
      }

      // 然后更新进行中项目的进度
      setProcessingItems(prevItems => {
        const updated = prevItems.map(item => {
          if (item.status === 'processing') {
            const elapsed = Date.now() - item.startTime;
            const elapsedMinutes = elapsed / (1000 * 60);
            
            // 模拟进度：前2分钟快速到30%，然后缓慢增长到90%
            let progress = 0;
            if (elapsedMinutes < 2) {
              progress = Math.min(30, (elapsedMinutes / 2) * 30);
            } else {
              // 2分钟后缓慢增长到90%（留10%给实际完成）
              const remainingTime = Math.max(0, 8 - elapsedMinutes);
              progress = Math.min(90, 30 + ((6 - remainingTime) / 6) * 60);
            }
            
            return { ...item, progress: Math.round(progress) };
          }
          return item;
        });
        
        // 更新localStorage
        localStorage.setItem('processingPodcasts', JSON.stringify(updated));
        return updated;
      });
    };

    const interval = setInterval(updateProgress, 2000); // 每2秒更新一次
    return () => clearInterval(interval);
  }, [isVisible]);

  const removeItem = (id: string) => {
    const updated = processingItems.filter(item => item.id !== id);
    setProcessingItems(updated);
    localStorage.setItem('processingPodcasts', JSON.stringify(updated));
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing': return '处理中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      default: return '未知';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatDuration = (startTime: number) => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分钟`;
    return `${Math.floor(duration / 3600)}小时`;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">正在处理的播客</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500">阿茂每天可以处理5条播客链接哦</p>
        </div>
        
        {/* 标签页导航 */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('processing')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'processing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              进行中 ({processingItems.filter(item => item.status === 'processing').length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'completed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              已完成 ({processingItems.filter(item => item.status === 'completed' || item.status === 'failed').length})
            </button>
          </nav>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'processing' ? (
            // 进行中标签页
            processingItems.filter(item => item.status === 'processing').length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>暂无正在处理的播客</p>
              </div>
            ) : (
              <div className="space-y-4">
                {processingItems.filter(item => item.status === 'processing').map((item) => (
                  <ProcessingItemCard key={item.id} item={item} removeItem={removeItem} />
                ))}
              </div>
            )
          ) : (
            // 已完成标签页
            processingItems.filter(item => item.status === 'completed' || item.status === 'failed').length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>暂无已完成的播客</p>
              </div>
            ) : (
              <div className="space-y-4">
                {processingItems.filter(item => item.status === 'completed' || item.status === 'failed').map((item) => (
                  <ProcessingItemCard key={item.id} item={item} removeItem={removeItem} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// 提取处理项目卡片为独立组件
function ProcessingItemCard({ item, removeItem }: { item: ProcessingItem; removeItem: (id: string) => void }) {
  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing': return '处理中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      default: return '未知';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatDuration = (startTime: number) => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    if (duration < 60) return `${duration}秒`;
    if (duration < 3600) return `${Math.floor(duration / 60)}分钟`;
    return `${Math.floor(duration / 3600)}小时`;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {item.title || '正在解析播客信息...'}
          </h3>
          <p className="text-sm text-gray-500 mt-1 truncate">
            {item.url}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
              {getStatusText(item.status)}
            </span>
            <span className="text-xs text-gray-500">
              已用时: {formatDuration(item.startTime)}
            </span>
            {item.status === 'processing' && (
              <span className="text-xs text-blue-600">
                {item.progress}%
              </span>
            )}
          </div>
          {item.status === 'processing' && (
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          )}
          {item.status === 'failed' && item.error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              错误: {item.error}
            </div>
          )}
        </div>
        {(item.status === 'completed' || item.status === 'failed') && (
          <button
            onClick={() => removeItem(item.id)}
            className="ml-4 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
