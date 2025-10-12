"use client";

import { useState, useEffect } from 'react';
import { 
  getProcessingEstimate, 
  formatTime, 
  formatElapsedTime, 
  getStepStatus, 
  getStepProgress,
  type ProcessingStep as EstimatorStep
} from '@/utils/processing-estimator';

type ProcessingStep = {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  estimatedTime?: number; // 预计时间（秒）
  actualTime?: number; // 实际时间（秒）
};

type ProcessingItem = {
  id: string;
  url: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  title?: string;
  startTime: number;
  completedAt?: number; // 完成时间戳
  error?: string;
  steps: ProcessingStep[];
  currentStep?: string;
  estimatedTotalTime?: number; // 预计总时间（秒）
  canCancel?: boolean;
};

interface EnhancedProcessingStatusProps {
  isVisible: boolean;
  onClose: () => void;
  onCancel?: (id: string) => void;
}

export function EnhancedProcessingStatus({ isVisible, onClose, onCancel }: EnhancedProcessingStatusProps) {
  const [processingItems, setProcessingItems] = useState<ProcessingItem[]>([]);
  const [activeTab, setActiveTab] = useState<'processing' | 'completed'>('processing');

  useEffect(() => {
    if (isVisible) {
      loadProcessingItems();
    }
  }, [isVisible]);

  const loadProcessingItems = () => {
    const stored = localStorage.getItem('processingPodcasts');
    if (stored) {
      try {
        const items = JSON.parse(stored);
        // 为每个项目添加详细的步骤信息
        const enhancedItems = items.map((item: any) => enhanceProcessingItem(item));
        setProcessingItems(enhancedItems);
      } catch (error) {
        console.error('Failed to parse processing items:', error);
      }
    }
  };

  const enhanceProcessingItem = (item: any): ProcessingItem => {
    const elapsed = Date.now() - item.startTime;
    const elapsedSeconds = elapsed / 1000;
    
    // 使用智能估算系统
    const estimate = getProcessingEstimate(elapsedSeconds);
    
    // 转换为组件需要的步骤格式
    const steps: ProcessingStep[] = estimate.steps.map((step, index) => {
      let accumulatedTime = 0;
      for (let i = 0; i < index; i++) {
        accumulatedTime += estimate.steps[i].estimatedTime;
      }
      
      let status = getStepStatus(
        step.id,
        estimate.currentStep,
        elapsedSeconds,
        step.estimatedTime,
        accumulatedTime
      );
      
      // 如果实际状态还是processing，但估算显示所有步骤都完成，
      // 那么最后一个步骤应该显示为active而不是completed
      if (item.status === 'processing' && status === 'completed' && step.id === 'summarize') {
        status = 'active';
      }
      
      const progress = getStepProgress(
        step.id,
        estimate.currentStep,
        elapsedSeconds,
        step.estimatedTime,
        accumulatedTime
      );
      
      return {
        id: step.id,
        name: step.name,
        description: step.description,
        status,
        progress: Math.round(progress),
        estimatedTime: step.estimatedTime,
        actualTime: status === 'completed' ? step.estimatedTime : 
                   status === 'active' ? Math.min(step.estimatedTime, elapsedSeconds - accumulatedTime) : 0
      };
    });

    // 检查是否所有步骤都已完成
    const allStepsCompleted = steps.every(step => step.status === 'completed');
    let overallProgress = Math.round(estimate.overallProgress * 100);
    
    // 如果状态仍为processing，但估算进度达到100%，说明可能还在等待服务器响应
    // 在这种情况下，我们应该显示一个合理的进度（比如95%），而不是100%
    if (item.status === 'processing' && overallProgress >= 100) {
      overallProgress = 95; // 显示95%，表示接近完成但还在处理中
    }
    
    // 只有当实际状态为completed时，才显示100%
    if (item.status === 'completed') {
      overallProgress = 100;
    }

    // 确定当前步骤显示
    let currentStepDisplay = estimate.currentStep;
    if (item.status === 'processing' && estimate.currentStep === 'completed') {
      currentStepDisplay = 'summarize'; // 如果还在处理中，显示最后一个步骤
    }

    return {
      ...item,
      steps,
      currentStep: currentStepDisplay,
      progress: overallProgress,
      estimatedTotalTime: estimate.totalEstimatedTime,
      estimatedRemainingTime: item.status === 'processing' ? Math.max(30, estimate.estimatedRemainingTime) : 0,
      canCancel: item.status === 'processing'
    };
  };

  // 定期更新进度
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setProcessingItems(prevItems => {
        return prevItems.map(item => {
          if (item.status === 'processing') {
            return enhanceProcessingItem(item);
          }
          return item;
        });
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const removeItem = (id: string) => {
    const updated = processingItems.filter(item => item.id !== id);
    setProcessingItems(updated);
    localStorage.setItem('processingPodcasts', JSON.stringify(updated));
  };

  const handleCancel = (id: string) => {
    if (onCancel) {
      onCancel(id);
    }
    // 更新状态为取消
    setProcessingItems(prevItems => 
      prevItems.map(item => 
        item.id === id 
          ? { ...item, status: 'failed' as const, error: '用户取消' }
          : item
      )
    );
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
    return formatElapsedTime(Date.now() - startTime);
  };

  const formatEstimatedTime = (seconds: number) => {
    return formatTime(seconds);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">播客处理状态</h2>
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
        
        <div className="p-6 overflow-y-auto max-h-[70vh]">
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
              <div className="space-y-6">
                {processingItems.filter(item => item.status === 'processing').map((item) => (
                  <EnhancedProcessingItemCard 
                    key={item.id} 
                    item={item} 
                    removeItem={removeItem}
                    onCancel={handleCancel}
                  />
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

// 增强的处理项目卡片
function EnhancedProcessingItemCard({ 
  item, 
  removeItem, 
  onCancel 
}: { 
  item: ProcessingItem; 
  removeItem: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const formatDuration = (startTime: number) => {
    return formatElapsedTime(Date.now() - startTime);
  };

  const formatEstimatedTime = (seconds: number) => {
    return formatTime(seconds);
  };

  const getStepIcon = (step: ProcessingStep) => {
    switch (step.status) {
      case 'completed':
        return (
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'active':
        return (
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          </div>
        );
      case 'failed':
        return (
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
        );
    }
  };

  const currentStep = item.steps.find(step => step.status === 'active');
  const estimatedRemainingTime = item.status === 'processing' 
    ? Math.max(30, item.estimatedRemainingTime || 0) // 如果还在处理中，至少显示30秒
    : 0;

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
      {/* 标题和基本信息 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate text-lg">
            {item.title || '正在解析播客信息...'}
          </h3>
          <p className="text-sm text-gray-500 mt-1 truncate">
            {item.url}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-sm font-medium text-blue-600">
              处理中
            </span>
            <span className="text-xs text-gray-500">
              已用时: {formatDuration(item.startTime)}
            </span>
            <span className="text-xs text-blue-600">
              {item.progress}%
            </span>
            {estimatedRemainingTime > 0 && (
              <span className="text-xs text-gray-600">
                预计还需: {formatEstimatedTime(estimatedRemainingTime)}
              </span>
            )}
          </div>
        </div>
        {item.canCancel && (
          <button
            onClick={() => onCancel(item.id)}
            className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-300 hover:border-red-400 rounded-md transition-colors"
          >
            取消
          </button>
        )}
      </div>

      {/* 总体进度条 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>总体进度</span>
          <span>{item.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>

      {/* 当前步骤信息 */}
      {currentStep && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            </div>
            <span className="font-medium text-blue-900">{currentStep.name}</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">{currentStep.description}</p>
          {currentStep.estimatedTime && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-blue-600 mb-1">
                <span>步骤进度</span>
                <span>{Math.round(currentStep.progress)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${currentStep.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 步骤列表 */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">处理步骤</h4>
        {item.steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            {getStepIcon(step)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${
                  step.status === 'active' ? 'text-blue-600' : 
                  step.status === 'completed' ? 'text-green-600' : 
                  step.status === 'failed' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {step.name}
                </span>
                {step.actualTime && step.actualTime > 0 && (
                  <span className="text-xs text-gray-500">
                    {Math.round(step.actualTime)}秒
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 简化的已完成项目卡片
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
    // 对于已完成的项目，使用实际的完成时间
    if (item.status === 'completed' || item.status === 'failed') {
      // 如果有完成时间戳，使用它；否则使用开始时间 + 12分钟作为估算
      const endTime = (item as any).completedAt || (startTime + 12 * 60 * 1000);
      return formatElapsedTime(endTime - startTime);
    }
    // 对于正在处理的项目，使用实际经过的时间
    return formatElapsedTime(Date.now() - startTime);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {item.title || '播客处理'}
          </h3>
          <p className="text-sm text-gray-500 mt-1 truncate">
            {item.url}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
              {getStatusText(item.status)}
            </span>
            <span className="text-xs text-gray-500">
              用时: {formatDuration(item.startTime)}
            </span>
          </div>
          {item.status === 'failed' && item.error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              错误: {item.error}
            </div>
          )}
        </div>
        <button
          onClick={() => removeItem(item.id)}
          className="ml-4 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
