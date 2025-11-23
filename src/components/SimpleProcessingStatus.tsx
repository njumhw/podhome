'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatElapsedTime } from '@/utils/processing-estimator';

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
  metrics?: {
    audioDuration?: number;
    asrSegmentsCount?: number;
    chunksCount?: number;
    transcriptCompressionRatio?: number;
    reportCompressionRatio?: number;
    processingSteps?: {
      asr?: { status: 'pending' | 'running' | 'completed' | 'failed'; duration?: number };
      cleaning?: { status: 'pending' | 'running' | 'completed' | 'failed'; duration?: number };
      report?: { status: 'pending' | 'running' | 'completed' | 'failed'; duration?: number };
    };
  };
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
              
              // 更新metrics数据（无论任务是否完成）
              if (taskStatus.metrics) {
                const updatedItem = {
                  ...item,
                  metrics: taskStatus.metrics
                };
                
                const updatedItems = processingItems.map((storedItem: any) => 
                  storedItem.id === item.id ? updatedItem : storedItem
                );
                localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                window.dispatchEvent(new Event('storage'));
              }
              
              if (taskStatus.status === 'READY') {
                // 任务已完成，更新状态
                const updatedItem = {
                  ...item,
                  status: 'completed',
                  progress: 100,
                  title: taskStatus.result?.title,
                  completedAt: Date.now(),
                  metrics: taskStatus.metrics
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

      // 更新UI状态（不再显示具体进度，只保持处理中状态）
      setProcessingItems(prevItems => {
        return prevItems.map(item => {
          if (item.status === 'processing') {
            // 保持进度为50%，表示处理中，但不显示具体进度
            return {
              ...item,
              progress: 50
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
                completedAt: Date.now(),
                metrics: taskStatus.metrics
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

  const formatMetrics = (metrics?: ProcessingItem['metrics']) => {
    if (!metrics) return null;
    
    const items = [];
    
    if (metrics.audioDuration) {
      const minutes = Math.round(metrics.audioDuration / 60);
      items.push(`Duration: ${minutes}m`);
    }
    
    if (metrics.asrSegmentsCount) {
      items.push(`ASR: ${metrics.asrSegmentsCount}`);
    }
    
    if (metrics.chunksCount) {
      items.push(`Chunks: ${metrics.chunksCount}`);
    }
    
    if (metrics.transcriptCompressionRatio) {
      const ratio = (metrics.transcriptCompressionRatio * 100).toFixed(1);
      items.push(`Transcript: ${ratio}%`);
    }
    
    if (metrics.reportCompressionRatio) {
      const ratio = (metrics.reportCompressionRatio * 100).toFixed(1);
      items.push(`Report: ${ratio}%`);
    }
    
    return items.length > 0 ? items.join(' • ') : null;
  };

  const getStepStatus = (step?: { status: string; duration?: number }) => {
    if (!step) return null;
    
    const statusMap = {
      'pending': { text: 'Pending', color: 'text-zinc-500' },
      'running': { text: 'Running', color: 'text-indigo-400' },
      'completed': { text: 'Completed', color: 'text-emerald-400' },
      'failed': { text: 'Failed', color: 'text-rose-400' }
    };
    
    const status = statusMap[step.status as keyof typeof statusMap] || statusMap.pending;
    const duration = step.duration ? ` (${Math.round(step.duration / 1000)}s)` : '';
    
    return (
      <span className={`text-xs ${status.color} font-mono`}>
        {status.text}{duration}
      </span>
    );
  };

  if (!isVisible) return null;

  const processingCount = processingItems.filter(item => item.status === 'processing').length;
  const completedCount = processingItems.filter(item => item.status === 'completed' || item.status === 'failed').length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white font-sans">Processing Status</h2>
            <p className="text-sm text-zinc-400 mt-1 font-sans">Up to 2 podcasts can be processed per day</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('processing')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors font-sans ${
              activeTab === 'processing'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-300'
            }`}
          >
            In Progress ({processingCount})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors font-sans ${
              activeTab === 'completed'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {activeTab === 'processing' ? (
            <div className="space-y-4">
              {processingItems
                .filter(item => item.status === 'processing')
                .map((item) => (
                  <div key={item.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-indigo-400 font-sans">Processing...</span>
                        </div>
                        <p className="text-sm text-zinc-300 truncate font-mono" title={item.url}>{item.url}</p>
                        <div className="mt-3 text-xs text-zinc-400 bg-white/5 rounded-lg p-3 border border-white/10">
                          <p className="text-zinc-300 font-sans">Processing takes time. You can browse other podcasts while waiting.</p>
                        </div>
                        
                        {/* 处理步骤状态 */}
                        {item.metrics?.processingSteps && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-4 text-xs font-mono">
                              <span className="text-zinc-400">ASR: {getStepStatus(item.metrics.processingSteps.asr)}</span>
                              <span className="text-zinc-400">Cleaning: {getStepStatus(item.metrics.processingSteps.cleaning)}</span>
                              <span className="text-zinc-400">Report: {getStepStatus(item.metrics.processingSteps.report)}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* 处理指标 */}
                        {item.metrics && (
                          <div className="mt-2">
                            <div className="text-xs text-zinc-400 bg-white/5 rounded px-2 py-1 inline-block font-mono border border-white/10">
                              {formatMetrics(item.metrics)}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleCancel(item.id)}
                        className="ml-3 px-3 py-1.5 text-xs text-rose-400 border border-rose-500/50 rounded-lg hover:bg-rose-500/10 transition-colors flex-shrink-0 font-sans"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* 简化进度条 - 仅显示处理中状态，不显示具体进度 */}
                    <div className="mt-3">
                      <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-indigo-400 h-1 rounded-full animate-pulse"
                          style={{ width: '100%' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              
              {processingCount === 0 && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1 font-sans">No tasks in progress</h3>
                  <p className="text-xs text-zinc-400 mb-4 font-sans">Submit a new podcast link to start processing</p>
                  <Link 
                    href="/home" 
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline font-sans"
                    onClick={onClose}
                  >
                    Browse other podcasts →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {processingItems
                .filter(item => item.status === 'completed' || item.status === 'failed')
                .map((item) => (
                  <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-sm ${
                    item.status === 'completed' 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${
                          item.status === 'completed' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}></div>
                        <span className={`text-sm font-medium font-sans ${
                          item.status === 'completed' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {item.status === 'completed' ? 'Completed' : 'Failed'}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 truncate font-mono" title={item.url}>{item.url}</p>
                      {item.title && (
                        <p className="text-sm font-medium text-white mt-1 truncate font-sans" title={item.title}>{item.title}</p>
                      )}
                      <p className="text-xs text-zinc-400 mt-1 font-sans">
                        {item.status === 'completed' 
                          ? `Completed: ${item.completedAt ? new Date(item.completedAt).toLocaleString() : 'Unknown'}`
                          : 'Processing failed. Please try again or contact support.'
                        }
                      </p>
                      
                      {/* 处理指标 */}
                      {item.status === 'completed' && item.metrics && (
                        <div className="mt-2">
                          <div className="text-xs text-zinc-400 bg-white/5 rounded px-2 py-1 inline-block font-mono border border-white/10">
                            {formatMetrics(item.metrics)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {item.status === 'completed' && item.title && (
                        <button
                          onClick={() => window.open(`/podcast/${item.id}`, '_blank')}
                          className="px-3 py-1.5 text-xs text-indigo-400 border border-indigo-500/50 rounded-lg hover:bg-indigo-500/10 transition-colors font-sans"
                        >
                          View
                        </button>
                      )}
                      {item.status === 'failed' && (
                        <button
                          onClick={() => {
                            // 可以添加联系阿茅的逻辑，比如打开邮件或显示联系方式
                            alert('Please contact support: maoweihao@example.com or WeChat: your_wechat_id');
                          }}
                          className="px-3 py-1.5 text-xs text-rose-400 border border-rose-500/50 rounded-lg hover:bg-rose-500/10 transition-colors font-sans"
                        >
                          Contact
                        </button>
                      )}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="px-3 py-1.5 text-xs text-zinc-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors font-sans"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              
              {completedCount === 0 && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1 font-sans">No completed tasks</h3>
                  <p className="text-xs text-zinc-400 font-sans">Completed podcasts will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
