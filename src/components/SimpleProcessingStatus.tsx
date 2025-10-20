'use client';

import React, { useState, useEffect } from 'react';
import { formatElapsedTime, formatTime } from '@/utils/processing-estimator';

interface ProcessingItem {
  id: string;
  url: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  title?: string;
  completedAt?: number;
  taskId?: string;
  estimatedRemainingTime?: number;
}

interface SimpleProcessingStatusProps {
  isVisible: boolean;
  onClose: () => void;
  onCancel?: (id: string) => void;
}

export default function SimpleProcessingStatus({ 
  isVisible, 
  onClose, 
  onCancel 
}: SimpleProcessingStatusProps) {
  const [processingItems, setProcessingItems] = useState<ProcessingItem[]>([]);
  const [activeTab, setActiveTab] = useState<'processing' | 'completed'>('processing');

  // 从localStorage加载处理项目
  useEffect(() => {
    if (typeof window !== 'undefined') {
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
  }, []);

  // 监听localStorage变化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleStorageChange = () => {
        const stored = localStorage.getItem('processingPodcasts');
        if (stored) {
          try {
            const items = JSON.parse(stored);
            setProcessingItems(items);
          } catch (error) {
            console.error('Failed to parse processing items:', error);
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
    
    // 清理僵尸任务
    cleanupStaleTasks();
  }, []);

  // 定期更新进度和检查任务状态
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(async () => {
      // 获取当前处理中的项目
      const processingItems = JSON.parse(localStorage.getItem('processingPodcasts') || '[]');
      const processingTasks = processingItems.filter((item: any) => 
        item.status === 'processing' && item.taskId
      );

      // 检查每个任务的状态
      for (const item of processingTasks) {
        const elapsed = Date.now() - item.startTime;
        const elapsedMinutes = elapsed / (1000 * 60);
        
        // 如果任务运行超过10分钟，或者进度达到95%，强制检查任务状态
        const shouldCheckStatus = elapsedMinutes > 10 || item.progress >= 95;
        
        if (shouldCheckStatus) {
          try {
            const res = await fetch(`/api/task-status?taskId=${item.taskId}`);
            if (res.ok) {
              const taskStatus = await res.json();
              
              if (taskStatus.status === 'READY') {
                // 任务已完成，更新状态
                const updatedItem = {
                  ...item,
                  status: 'completed',
                  progress: 100,
                  title: taskStatus.result?.title,
                  completedAt: Date.now()
                };
                
                // 更新localStorage
                const updatedItems = processingItems.map((storedItem: any) => 
                  storedItem.id === item.id ? updatedItem : storedItem
                );
                localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                window.dispatchEvent(new Event('storage'));
                
              } else if (taskStatus.status === 'FAILED') {
                // 任务失败，更新状态
                const updatedItem = {
                  ...item,
                  status: 'failed',
                  progress: 0
                };
                
                // 更新localStorage
                const updatedItems = processingItems.map((storedItem: any) => 
                  storedItem.id === item.id ? updatedItem : storedItem
                );
                localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                window.dispatchEvent(new Event('storage'));
              }
            }
          } catch (error) {
            console.error('检查任务状态失败:', error);
          }
        }
      }

      // 更新UI状态（基于时间估算的进度）
      setProcessingItems(prevItems => {
        return prevItems.map(item => {
          if (item.status === 'processing') {
            const elapsed = Date.now() - item.startTime;
            const elapsedMinutes = elapsed / (1000 * 60);
            
            // 基于时间的简单进度估算
            let progress = Math.min(95, (elapsedMinutes / 15) * 100); // 假设15分钟完成
            
            return {
              ...item,
              progress: Math.round(progress),
              estimatedRemainingTime: Math.max(60, (15 - elapsedMinutes) * 60)
            };
          }
          return item;
        });
      });
    }, 10000); // 每10秒检查一次任务状态

    return () => clearInterval(interval);
  }, [isVisible]);

  const removeItem = (id: string) => {
    const updated = processingItems.filter(item => item.id !== id);
    setProcessingItems(updated);
    localStorage.setItem('processingPodcasts', JSON.stringify(updated));
  };

  // 清理长时间运行的任务
  const cleanupStaleTasks = async () => {
    const processingItems = JSON.parse(localStorage.getItem('processingPodcasts') || '[]');
    const staleTasks = processingItems.filter((item: any) => {
      if (item.status !== 'processing') return false;
      const elapsed = Date.now() - item.startTime;
      const elapsedMinutes = elapsed / (1000 * 60);
      return elapsedMinutes > 30; // 超过30分钟的任务
    });

    for (const task of staleTasks) {
      if (task.taskId) {
        try {
          const res = await fetch(`/api/task-status?taskId=${task.taskId}`);
          if (res.ok) {
            const taskStatus = await res.json();
            if (taskStatus.status === 'READY' || taskStatus.status === 'FAILED') {
              // 任务已完成，更新状态
              const updatedItem = {
                ...task,
                status: taskStatus.status === 'READY' ? 'completed' : 'failed',
                progress: taskStatus.status === 'READY' ? 100 : 0,
                title: taskStatus.result?.title,
                completedAt: Date.now()
              };
              
              const updatedItems = processingItems.map((storedItem: any) => 
                storedItem.id === task.id ? updatedItem : storedItem
              );
              localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
              window.dispatchEvent(new Event('storage'));
            }
          }
        } catch (error) {
          console.error('清理僵尸任务失败:', error);
        }
      }
    }
  };

  const handleCancel = (id: string) => {
    if (onCancel) {
      onCancel(id);
    }
    // 更新状态为取消
    setProcessingItems(prevItems => 
      prevItems.map(item => 
        item.id === id 
          ? { ...item, status: 'failed' as const }
          : item
      )
    );
  };


  const formatDuration = (startTime: number) => {
    return formatElapsedTime(Date.now() - startTime);
  };

  if (!isVisible) return null;

  const processingCount = processingItems.filter(item => item.status === 'processing').length;
  const completedCount = processingItems.filter(item => item.status === 'completed' || item.status === 'failed').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">播客处理状态</h2>
            <p className="text-sm text-gray-600 mt-1">阿茂每天可以处理5条播客链接哦</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('processing')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'processing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            进行中 ({processingCount})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'completed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            已完成 ({completedCount})
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          {activeTab === 'processing' ? (
            <div className="space-y-3">
              {processingItems
                .filter(item => item.status === 'processing')
                .map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-blue-600">阿茂在听啦</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate" title={item.url}>{item.url}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>已用时: {formatDuration(item.startTime)}</span>
                          <span>{item.progress}%</span>
                          <span>预计还需: {formatTime(item.estimatedRemainingTime || 0)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancel(item.id)}
                        className="ml-3 px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        取消
                      </button>
                    </div>

                    {/* 简化进度条 */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              
              {processingCount === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">暂无进行中的任务</h3>
                  <p className="text-xs text-gray-500">提交新的播客链接开始处理</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {processingItems
                .filter(item => item.status === 'completed' || item.status === 'failed')
                .map((item) => (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.status === 'completed' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${
                          item.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <span className={`text-sm font-medium ${
                          item.status === 'completed' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.status === 'completed' ? '已完成' : '阿茂去摸鱼了'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate" title={item.url}>{item.url}</p>
                      {item.title && (
                        <p className="text-sm font-medium text-gray-900 mt-1 truncate" title={item.title}>{item.title}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {item.status === 'completed' 
                          ? `完成时间: ${item.completedAt ? new Date(item.completedAt).toLocaleString() : '未知'}`
                          : '不好意思，阿茂好像去摸鱼了，请联系下阿茅吧'
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {item.status === 'completed' && item.title && (
                        <button
                          onClick={() => window.open(`/podcast/${item.id}`, '_blank')}
                          className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                        >
                          查看
                        </button>
                      )}
                      {item.status === 'failed' && (
                        <button
                          onClick={() => {
                            // 可以添加联系阿茅的逻辑，比如打开邮件或显示联系方式
                            alert('请联系阿茅：maoweihao@example.com 或微信：your_wechat_id');
                          }}
                          className="px-2 py-1 text-xs text-orange-600 border border-orange-200 rounded hover:bg-orange-50 transition-colors"
                        >
                          联系阿茅
                        </button>
                      )}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                ))}
              
              {completedCount === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">暂无已完成的任务</h3>
                  <p className="text-xs text-gray-500">处理完成的播客会显示在这里</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
