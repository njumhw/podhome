"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { useUser } from '@/hooks/useUser';

type PodcastItem = {
  id: string;
  title: string;
  author: string;
  publishedAt: string | null;
  audioUrl: string;
  originalUrl: string;
  summary: string | null;
  topic: string | null;
  updatedAt: string;
  likeCount?: number;
};

type SearchResult = {
  hits: PodcastItem[];
  notFound: boolean;
};

type ListResult = {
  items: PodcastItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};


export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useUser();
  const toast = useToast();

  const [latest, setLatest] = useState<PodcastItem[]>([]);
  const [hot, setHot] = useState<PodcastItem[]>([]);
  const [allPodcasts, setAllPodcasts] = useState<PodcastItem[]>([]);
  const [showAllPodcasts, setShowAllPodcasts] = useState(false);
  const [allPodcastsPage, setAllPodcastsPage] = useState(1);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [topics, setTopics] = useState<Array<{id: string, name: string, color?: string}>>([]);
  const [allPodcastsTotal, setAllPodcastsTotal] = useState(0);
  const [loading, setLoading] = useState({ latest: false, hot: false, allPodcasts: false });

  // 加载主题列表
  const loadTopics = async () => {
    try {
      const response = await fetch('/api/public/topics');
      const data = await response.json();
      if (data.success) {
        setTopics(data.topics);
      }
    } catch (error) {
      console.error('加载主题失败:', error);
    }
  };

  // 加载首页数据 - 优化并行加载
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 并行加载所有数据
        const [latestRes, hotRes, topicsRes, userRes] = await Promise.allSettled([
          fetch('/api/public/list?type=latest&limit=10'),
          fetch('/api/public/list?type=hot&limit=10'),
          fetch('/api/public/topics'),
          fetch("/api/auth/me")
        ]);

        // 处理最新播客
        if (latestRes.status === 'fulfilled' && latestRes.value.ok) {
          const data = await latestRes.value.json();
          setLatest(data.items || []);
        }

        // 处理热门播客
        if (hotRes.status === 'fulfilled' && hotRes.value.ok) {
          const data = await hotRes.value.json();
          setHot(data.items || []);
        }

        // 处理主题
        if (topicsRes.status === 'fulfilled' && topicsRes.value.ok) {
          const data = await topicsRes.value.json();
          if (data.success) {
            setTopics(data.topics);
          }
        }

        // 用户状态由useUser hook管理，这里不需要处理
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadInitialData();
  }, []);

  const loadLatest = async () => {
    setLoading(prev => ({ ...prev, latest: true }));
    try {
      const res = await fetch('/api/public/list?type=latest&limit=10');
      const data: ListResult = await res.json();
      setLatest(data.items || []);
    } catch (error) {
      console.error('Failed to load latest:', error);
      setLatest([]);
    } finally {
      setLoading(prev => ({ ...prev, latest: false }));
    }
  };

  const loadHot = async () => {
    setLoading(prev => ({ ...prev, hot: true }));
    try {
      const res = await fetch('/api/public/list?type=hot&limit=10');
      const data: ListResult = await res.json();
      setHot(data.items || []);
    } catch (error) {
      console.error('Failed to load hot:', error);
      setHot([]);
    } finally {
      setLoading(prev => ({ ...prev, hot: false }));
    }
  };


  const loadAllPodcasts = async (page = 1, topic = '') => {
    setLoading(prev => ({ ...prev, allPodcasts: true }));
    try {
      let url = `/api/public/list?type=latest&limit=10&page=${page}`;
      if (topic) {
        url += `&topic=${encodeURIComponent(topic)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data: ListResult = await res.json();
        setAllPodcasts(data.items || []);
        // 安全地访问pagination，避免undefined错误
        if (data.pagination && typeof data.pagination.total === 'number') {
          setAllPodcastsTotal(data.pagination.total);
        } else {
          console.warn('API响应缺少pagination信息:', data);
          setAllPodcastsTotal(0);
        }
        setAllPodcastsPage(page);
      } else {
        console.error('API请求失败:', res.status, res.statusText);
        setAllPodcasts([]);
        setAllPodcastsTotal(0);
      }
    } catch (error) {
      console.error('Failed to load all podcasts:', error);
      setAllPodcasts([]);
    } finally {
      setLoading(prev => ({ ...prev, allPodcasts: false }));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      console.log('Starting search for:', searchQuery.trim());
      const url = `/api/public/search?q=${encodeURIComponent(searchQuery.trim())}`;
      console.log('Search URL:', url);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Search response status:', res.status);
      console.log('Search response headers:', res.headers);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const result: SearchResult = await res.json();
      console.log('Search API response:', result);
      
      // 确保返回的数据结构正确
      if (result && typeof result === 'object') {
        const searchResult = {
          hits: result.hits || [],
          notFound: result.notFound || false
        };
        console.log('Setting search result:', searchResult);
        setSearchResult(searchResult);
      } else {
        console.log('Invalid result, setting notFound=true');
        setSearchResult({ hits: [], notFound: true });
      }
    } catch (error) {
      console.error('Search failed:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      setSearchResult({ hits: [], notFound: true });
    } finally {
      setIsSearching(false);
    }
  };

  const handleProcessPodcast = async (url: string) => {
    // 检查是否已经在处理这个URL
    const existing = localStorage.getItem('processingPodcasts');
    const items = existing ? JSON.parse(existing) : [];
    const alreadyProcessing = items.some((item: any) => 
      item.url === url && item.status === 'processing'
    );
    
    if (alreadyProcessing) {
      toast.warning('已在处理中', '这个播客链接已经在处理队列中了');
      return;
    }

    // 创建处理项目
    const processingId = `processing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processingItem = {
      id: processingId,
      url: url,
      status: 'processing' as const,
      progress: 0,
      startTime: Date.now(),
      taskId: null as string | null
    };

    // 保存到localStorage
    items.push(processingItem);
    localStorage.setItem('processingPodcasts', JSON.stringify(items));

    // 触发storage事件，通知Header组件更新
    window.dispatchEvent(new Event('storage'));

    try {
      console.log('🚀 开始提交播客处理请求:', url);
      
      // 使用异步处理API，添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      let res: Response;
      try {
        console.log('📡 发送API请求到 /api/process-audio-async');
        res = await fetch('/api/process-audio-async', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log('✅ API请求完成，状态码:', res.status, res.statusText);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.error('❌ API请求失败:', {
          name: fetchError.name,
          message: errorMessage,
          stack: fetchError.stack
        });
        
        // 详细诊断网络错误
        if (fetchError.name === 'AbortError' || errorMessage.includes('aborted')) {
          throw new Error('请求超时：服务器响应时间超过30秒，请检查网络连接或稍后重试');
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          throw new Error('网络连接失败：无法连接到服务器，请检查网络连接或确认服务器是否正常运行');
        } else if (errorMessage.includes('CORS')) {
          throw new Error('跨域请求失败：请检查服务器CORS配置');
        } else {
          throw new Error(`网络请求失败: ${errorMessage}`);
        }
      }

      if (!res.ok) {
        let errorData: any = {};
        try {
          errorData = await res.json();
        } catch (e) {
          // 如果响应不是JSON，尝试读取文本
          const text = await res.text().catch(() => '');
          errorData = { error: text || `HTTP ${res.status} ${res.statusText}` };
        }
        
        const errorMessage = errorData.error || `服务器错误 (${res.status})`;
        
        // 根据状态码提供更详细的错误信息
        if (res.status === 401) {
          throw new Error('请先登录后再处理播客');
        } else if (res.status === 429) {
          throw new Error('今日处理额度已用完，请明天再试');
        } else if (res.status === 500) {
          throw new Error(`服务器内部错误: ${errorMessage}`);
        } else if (res.status === 503) {
          throw new Error('服务暂时不可用，请稍后重试');
        } else {
          throw new Error(errorMessage);
        }
      }

      let result: any;
      try {
        result = await res.json();
        console.log('📦 API响应数据:', result);
      } catch (jsonError) {
        console.error('❌ JSON解析失败:', jsonError);
        const text = await res.text().catch(() => '');
        console.error('响应文本:', text.substring(0, 500));
        throw new Error(`服务器响应格式错误: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
      }
      
      // 验证响应数据
      if (!result) {
        console.error('❌ API响应为空');
        throw new Error('服务器返回了空响应');
      }
      
      if (!result.success) {
        console.error('❌ API返回失败:', result);
        throw new Error(result?.error || result?.message || '服务器返回了失败响应');
      }
      
      if (!result.taskId) {
        console.error('❌ API响应缺少taskId:', result);
        throw new Error('服务器响应格式错误：缺少taskId');
      }
      
      console.log('✅ 任务提交成功，taskId:', result.taskId);
      
      // 更新处理项目，添加taskId
      const updatedItems = items.map((item: any) => 
        item.id === processingId 
          ? { 
              ...item, 
              taskId: result.taskId,
              status: 'processing' // 保持processing状态，等待后台处理
            }
          : item
      );
      localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
      window.dispatchEvent(new Event('storage'));
      
      // 显示成功消息
      toast.success('任务已提交', '播客处理任务已提交，正在后台处理中...');
      
      // 延迟2秒后开始轮询，给任务一些时间开始处理
      // 这样可以避免任务刚提交时立即轮询可能遇到的网络错误
      setTimeout(() => {
        pollTaskStatus(result.taskId, processingId);
      }, 2000);

    } catch (error) {
      console.error('Processing failed:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // 更新处理状态为失败
      const errorMessage = error instanceof Error ? error.message : String(error);
      const updatedItems = items.map((item: any) => 
        item.id === processingId 
          ? { ...item, status: 'failed', progress: 0, error: errorMessage }
          : item
      );
      localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
      window.dispatchEvent(new Event('storage'));
      
      // 显示友好的错误信息，根据错误类型提供不同的提示
      if (errorMessage.includes('请先登录')) {
        toast.error('请先登录', '请先登录后再处理播客', {
          action: {
            label: '去登录',
            onClick: () => window.location.href = '/login'
          }
        });
      } else if (errorMessage.includes('额度已用完')) {
        toast.warning('今日额度已用完', '今日处理额度已用完，请明天再试');
      } else if (errorMessage.includes('请求超时') || errorMessage.includes('超时')) {
        toast.error('请求超时', errorMessage, {
          action: {
            label: '重试',
            onClick: () => handleProcessPodcast(url)
          }
        });
      } else if (errorMessage.includes('网络连接失败') || errorMessage.includes('无法连接到服务器')) {
        toast.error('网络连接失败', errorMessage, {
          action: {
            label: '重试',
            onClick: () => handleProcessPodcast(url)
          }
        });
      } else if (errorMessage.includes('服务器内部错误')) {
        toast.error('服务器错误', errorMessage, {
          action: {
            label: '联系支持',
            onClick: () => alert('请联系支持：maoweihao@example.com')
          }
        });
      } else {
        toast.error('处理失败', errorMessage || '未知错误，请稍后重试', {
          action: {
            label: '重试',
            onClick: () => handleProcessPodcast(url)
          }
        });
      }
    }
  };

  // 轮询任务状态
  const pollTaskStatus = async (taskId: string, processingId: string) => {
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5; // 增加到5次，给更多重试机会
    let pollCount = 0;
    let lastSuccessfulPoll = Date.now(); // 记录最后一次成功轮询的时间
    
    console.log(`🔄 开始轮询任务状态: ${taskId}`);
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      try {
        console.log(`📡 轮询任务状态 (第${pollCount}次): ${taskId}`);
        const res = await fetch(`/api/task-status?taskId=${taskId}`, {
          signal: AbortSignal.timeout(10000) // 10秒超时
        });
        
        if (!res.ok) {
          consecutiveErrors++;
          console.warn(`⚠️ 任务状态查询失败 (${consecutiveErrors}/${maxConsecutiveErrors}): HTTP ${res.status}`);
          
          // 只有在连续失败且距离最后一次成功轮询超过30秒时，才考虑标记为失败
          // 这样可以避免任务刚提交时立即轮询可能遇到的网络错误
          const timeSinceLastSuccess = Date.now() - lastSuccessfulPoll;
          if (consecutiveErrors >= maxConsecutiveErrors && timeSinceLastSuccess > 30000) {
            clearInterval(pollInterval);
            
            // 在标记为失败之前，先尝试通过URL搜索播客，看看是否已经成功保存
            try {
              const existing = localStorage.getItem('processingPodcasts');
              const items = existing ? JSON.parse(existing) : [];
              const currentItem = items.find((item: any) => item.id === processingId);
              
              if (currentItem?.url) {
                console.log('🔍 HTTP错误后，尝试通过URL搜索播客:', currentItem.url);
                const searchRes = await fetch(`/api/public/search?q=${encodeURIComponent(currentItem.url)}`);
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  if (searchData.results && searchData.results.length > 0) {
                    const podcast = searchData.results[0];
                    console.log('✅ 发现播客已成功保存:', podcast.id);
                    
                    // 更新处理状态为完成
                    const updatedItems = items.map((item: any) => 
                      item.id === processingId 
                        ? { 
                            ...item, 
                            status: 'completed', 
                            progress: 100, 
                            title: podcast.title,
                            error: null,
                            completedAt: Date.now()
                          }
                        : item
                    );
                    localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                    window.dispatchEvent(new Event('storage'));
                    
                    // 刷新首页数据
                    loadLatest();
                    loadHot();
                    
                    // 显示右上角通知，不自动跳转
                    toast.success(
                      '处理完成',
                      `${podcast.title || '播客'} 已处理完成，点击查看`,
                      {
                        duration: 8000,
                        action: {
                          label: '查看',
                          onClick: () => {
                            window.location.href = `/podcast/${podcast.id}`;
                          }
                        }
                      }
                    );
                    return;
                  }
                }
              }
            } catch (searchError) {
              console.warn('搜索播客失败，继续标记为失败:', searchError);
            }
            
            // 更新处理状态为失败
            const existing = localStorage.getItem('processingPodcasts');
            const items = existing ? JSON.parse(existing) : [];
            const updatedItems = items.map((item: any) => 
              item.id === processingId 
                ? { 
                    ...item, 
                    status: 'failed', 
                    progress: 0, 
                    error: `无法获取任务状态 (HTTP ${res.status})，请稍后重试或检查任务是否正在处理中`
                  }
                : item
            );
            localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
            window.dispatchEvent(new Event('storage'));
            
            toast.error('处理失败', `无法获取任务状态，请稍后重试或检查任务是否正在处理中`);
            return;
          }
          
          // 等待下次重试
          return;
        }
        
        // 请求成功，更新最后成功时间并重置错误计数
        lastSuccessfulPoll = Date.now();
        if (consecutiveErrors > 0) {
          console.log(`✅ 任务状态查询恢复成功，重置错误计数`);
          consecutiveErrors = 0;
        }
        
        const taskStatus = await res.json();
        console.log(`📦 任务状态响应:`, {
          status: taskStatus.status,
          hasResult: !!taskStatus.result,
          error: taskStatus.error
        });
        
        // 如果任务状态为READY，说明处理成功
        if (taskStatus.status === 'READY') {
          clearInterval(pollInterval);
          
          // 更新处理状态为完成
          const existing = localStorage.getItem('processingPodcasts');
          const items = existing ? JSON.parse(existing) : [];
          const updatedItems = items.map((item: any) => 
            item.id === processingId 
              ? { 
                  ...item, 
                  status: 'completed', 
                  progress: 100, 
                  title: taskStatus.result?.title,
                  error: null, // 清除之前的错误信息
                  completedAt: Date.now()
                }
              : item
          );
          localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
          window.dispatchEvent(new Event('storage'));
          
          // 刷新首页数据
          loadLatest();
          loadHot();
          
          // 显示右上角通知，不自动跳转
          if (taskStatus.result?.id) {
            const podcastTitle = taskStatus.result?.title || '播客';
            toast.success(
              '处理完成',
              `${podcastTitle} 已处理完成，点击查看`,
              {
                duration: 8000, // 8秒后自动消失
                action: {
                  label: '查看',
                  onClick: () => {
                    window.location.href = `/podcast/${taskStatus.result.id}`;
                  }
                }
              }
            );
          } else {
            toast.success('处理完成', '播客已处理完成，请刷新页面查看');
          }
          
        } else if (taskStatus.status === 'FAILED') {
          clearInterval(pollInterval);
          
          // 判断是否是"立刻失败"（快速失败）
          const isQuickFailure = taskStatus.startedAt && taskStatus.completedAt && 
                               (new Date(taskStatus.completedAt).getTime() - new Date(taskStatus.startedAt).getTime()) < 5000; // 5秒内失败
          
          // 判断是否是网络相关错误
          const errorMessage = taskStatus.error || '播客处理失败';
          const isNetworkError = errorMessage.includes('fetch failed') || 
                                 errorMessage.includes('网络请求失败') ||
                                 errorMessage.includes('ECONNREFUSED') ||
                                 errorMessage.includes('ETIMEDOUT') ||
                                 errorMessage.includes('ENOTFOUND') ||
                                 errorMessage.includes('DNS') ||
                                 errorMessage.includes('网络连接');
          
          // 更新处理状态为失败
          const existing = localStorage.getItem('processingPodcasts');
          const items = existing ? JSON.parse(existing) : [];
          const updatedItems = items.map((item: any) => 
            item.id === processingId 
              ? { 
                  ...item, 
                  status: 'failed', 
                  progress: 0, 
                  error: errorMessage
                }
              : item
          );
          localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
          window.dispatchEvent(new Event('storage'));
          
          // 如果是快速失败且是网络错误，显示友好提示
          if (isQuickFailure && isNetworkError) {
            toast.error(
              '处理失败', 
              '当前服务器网络不稳定，可能是临时性网络问题。请稍后再试一次，通常第二次就能成功。',
              {
                duration: 8000, // 8秒后自动消失
                action: {
                  label: '重试',
                  onClick: () => {
                    // 从localStorage中获取失败的任务URL
                    const currentItems = JSON.parse(localStorage.getItem('processingPodcasts') || '[]');
                    const failedItem = currentItems.find((item: any) => item.id === processingId);
                    
                    // 从localStorage中移除失败的任务
                    const filteredItems = currentItems.filter((item: any) => item.id !== processingId);
                    localStorage.setItem('processingPodcasts', JSON.stringify(filteredItems));
                    window.dispatchEvent(new Event('storage'));
                    
                    // 重新提交处理请求
                    if (failedItem?.url) {
                      handleProcessPodcast(failedItem.url);
                    }
                  }
                }
              }
            );
          } else {
            // 其他情况显示普通错误提示
            toast.error('处理失败', errorMessage);
          }
        }
        
      } catch (error) {
        consecutiveErrors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : 'Unknown';
        
        console.error(`❌ 轮询任务状态失败 (${consecutiveErrors}/${maxConsecutiveErrors}):`, {
          name: errorName,
          message: errorMessage,
          taskId
        });
        
        // 如果是超时错误，给更多重试机会
        if (errorName === 'AbortError' || errorMessage.includes('timeout') || errorMessage.includes('超时')) {
          console.warn('⏱️ 请求超时，继续重试...');
          if (consecutiveErrors >= maxConsecutiveErrors * 2) {
            clearInterval(pollInterval);
            
            // 在标记为失败之前，先尝试通过URL搜索播客，看看是否已经成功保存
            try {
              const existing = localStorage.getItem('processingPodcasts');
              const items = existing ? JSON.parse(existing) : [];
              const currentItem = items.find((item: any) => item.id === processingId);
              
              if (currentItem?.url) {
                console.log('🔍 超时后，尝试通过URL搜索播客:', currentItem.url);
                const searchRes = await fetch(`/api/public/search?q=${encodeURIComponent(currentItem.url)}`);
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  if (searchData.results && searchData.results.length > 0) {
                    const podcast = searchData.results[0];
                    console.log('✅ 发现播客已成功保存:', podcast.id);
                    
                    // 更新处理状态为完成
                    const updatedItems = items.map((item: any) => 
                      item.id === processingId 
                        ? { 
                            ...item, 
                            status: 'completed', 
                            progress: 100, 
                            title: podcast.title,
                            error: null,
                            completedAt: Date.now()
                          }
                        : item
                    );
                    localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                    window.dispatchEvent(new Event('storage'));
                    
                    // 刷新首页数据
                    loadLatest();
                    loadHot();
                    
                    // 显示右上角通知，不自动跳转
                    toast.success(
                      '处理完成',
                      `${podcast.title || '播客'} 已处理完成，点击查看`,
                      {
                        duration: 8000,
                        action: {
                          label: '查看',
                          onClick: () => {
                            window.location.href = `/podcast/${podcast.id}`;
                          }
                        }
                      }
                    );
                    return;
                  }
                }
              }
            } catch (searchError) {
              console.warn('搜索播客失败，继续标记为失败:', searchError);
            }
            
            const existing = localStorage.getItem('processingPodcasts');
            const items = existing ? JSON.parse(existing) : [];
            const updatedItems = items.map((item: any) => 
              item.id === processingId 
                ? { 
                    ...item, 
                    status: 'failed', 
                    progress: 0, 
                    error: `请求超时：无法获取任务状态，任务可能仍在处理中，请稍后刷新页面查看`
                  }
                : item
            );
            localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
            window.dispatchEvent(new Event('storage'));
            toast.error('处理失败', `请求超时：无法获取任务状态，任务可能仍在处理中，请稍后刷新页面查看`);
            return;
          }
          return;
        }
        
        // 如果是网络错误，给更多重试机会
        if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
          console.warn('🌐 网络错误，继续重试...');
          if (consecutiveErrors >= maxConsecutiveErrors * 2) {
            clearInterval(pollInterval);
            
            // 在标记为失败之前，先尝试通过URL搜索播客，看看是否已经成功保存
            try {
              const existing = localStorage.getItem('processingPodcasts');
              const items = existing ? JSON.parse(existing) : [];
              const currentItem = items.find((item: any) => item.id === processingId);
              
              if (currentItem?.url) {
                console.log('🔍 网络错误后，尝试通过URL搜索播客:', currentItem.url);
                const searchRes = await fetch(`/api/public/search?q=${encodeURIComponent(currentItem.url)}`);
                if (searchRes.ok) {
                  const searchData = await searchRes.json();
                  if (searchData.results && searchData.results.length > 0) {
                    const podcast = searchData.results[0];
                    console.log('✅ 发现播客已成功保存:', podcast.id);
                    
                    // 更新处理状态为完成
                    const updatedItems = items.map((item: any) => 
                      item.id === processingId 
                        ? { 
                            ...item, 
                            status: 'completed', 
                            progress: 100, 
                            title: podcast.title,
                            error: null,
                            completedAt: Date.now()
                          }
                        : item
                    );
                    localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
                    window.dispatchEvent(new Event('storage'));
                    
                    // 刷新首页数据
                    loadLatest();
                    loadHot();
                    
                    // 显示右上角通知，不自动跳转
                    toast.success(
                      '处理完成',
                      `${podcast.title || '播客'} 已处理完成，点击查看`,
                      {
                        duration: 8000,
                        action: {
                          label: '查看',
                          onClick: () => {
                            window.location.href = `/podcast/${podcast.id}`;
                          }
                        }
                      }
                    );
                    return;
                  }
                }
              }
            } catch (searchError) {
              console.warn('搜索播客失败，继续标记为失败:', searchError);
            }
            
            // 如果搜索失败或未找到，标记为失败
            const existing = localStorage.getItem('processingPodcasts');
            const items = existing ? JSON.parse(existing) : [];
            const updatedItems = items.map((item: any) => 
              item.id === processingId 
                ? { 
                    ...item, 
                    status: 'failed', 
                    progress: 0, 
                    error: `网络错误：无法连接到服务器，请检查网络连接。如果任务已完成，请刷新页面查看。`
                  }
                : item
            );
            localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
            window.dispatchEvent(new Event('storage'));
            toast.error('处理失败', `网络错误：无法连接到服务器，请检查网络连接。如果任务已完成，请刷新页面查看。`);
            return;
          }
          return;
        }
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          clearInterval(pollInterval);
          
          // 更新处理状态为失败
          const existing = localStorage.getItem('processingPodcasts');
          const items = existing ? JSON.parse(existing) : [];
          const updatedItems = items.map((item: any) => 
            item.id === processingId 
              ? { 
                  ...item, 
                  status: 'failed', 
                  progress: 0, 
                  error: errorMessage || '获取任务状态失败'
                }
              : item
          );
          localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
          window.dispatchEvent(new Event('storage'));
          
          toast.error('处理失败', errorMessage || '获取任务状态失败，请稍后重试');
        }
      }
    }, 20000); // 每20秒轮询一次
    
    // 设置超时，避免无限轮询
    setTimeout(() => {
      clearInterval(pollInterval);
      
      // 超时后检查任务状态
      const existing = localStorage.getItem('processingPodcasts');
      const items = existing ? JSON.parse(existing) : [];
      const taskItem = items.find((item: any) => item.id === processingId);
      
      if (taskItem && taskItem.status === 'processing') {
        // 任务仍然在处理中，标记为超时
        const updatedItems = items.map((item: any) => 
          item.id === processingId 
            ? { 
                ...item, 
                status: 'failed', 
                progress: 0, 
                error: '处理超时，请重试'
              }
            : item
        );
        localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
        window.dispatchEvent(new Event('storage'));
        
        toast.error('处理超时', '播客处理超时，请稍后重试');
      }
    }, 3 * 60 * 60 * 1000); // 3小时超时，支持长时间播客处理
  };

  const handleShowAllPodcasts = () => {
    if (!showAllPodcasts) {
      setShowAllPodcasts(true);
      loadAllPodcasts(1);
    } else {
      setShowAllPodcasts(false);
    }
  };

  const handlePageChange = (page: number) => {
    loadAllPodcasts(page, selectedTopic);
  };

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    setAllPodcastsPage(1);
    loadAllPodcasts(1, topic);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        {/* 搜索区域 */}
        <div className="max-w-2xl mx-auto mb-8">
          <h1 className="text-3xl font-semibold text-center mb-3 text-gray-900">
            PodHome
          </h1>
          <p className="text-center text-gray-600 text-sm mb-6">
            输入播客链接或标题，其余都交给阿茂吧
          </p>
          
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入播客链接或标题..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isSearching ? '搜索中...' : '搜索'}
            </button>
          </div>

          {/* 权益说明 - 仅对游客显示 */}
          {!user && (
            <div className="mt-4 p-3 bg-white rounded-md border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                    游客：仅可搜索和浏览
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-900 rounded-full"></span>
                    用户：每天转录2个 + 评论互动
                  </span>
                </div>
                <a 
                  href="/register" 
                  className="text-gray-900 hover:underline font-medium"
                >
                  注册 →
                </a>
              </div>
            </div>
          )}

          {/* 搜索结果 */}
          {searchResult && (
            <div className="mt-4">
              {searchResult.hits && searchResult.hits.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900 text-sm">搜索结果：</h3>
                  {searchResult.hits.map((item) => (
                    <Link
                      key={item.id}
                      href={`/podcast/${item.id}`}
                      className="block p-3 bg-white rounded-md border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <h4 className="font-medium text-gray-900 text-sm">{item.title}</h4>
                      <div className="text-xs text-gray-600 mt-1 space-x-2">
                        {item.author && <span>{item.author}</span>}
                        {item.publishedAt && (
                          <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                        )}
                        {!item.author && !item.publishedAt && <span>未知时间</span>}
                      </div>
                      {item.summary && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {item.summary}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              ) : searchResult.notFound ? (
                <div className="text-center py-6">
                  {user ? (
                    <button
                      onClick={() => handleProcessPodcast(searchQuery)}
                      className="px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors duration-200"
                    >
                      未找到相关播客，交给阿茂吧（每小时播客需约3-5分钟）
                    </button>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <div className="text-gray-800 text-sm">
                        <p className="font-medium mb-2">请联系 阿茅（Wechat：njumwh）获取邀请码</p>
                        <p className="text-gray-600">注册并登录，从而获得播客转录权限</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

        </div>

        {/* 两列内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 最新 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">最新</h2>
            {loading.latest ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : latest.length > 0 ? (
              <div className="space-y-3">
                {latest.map((item) => (
                  <Link
                    key={item.id}
                    href={`/podcast/${item.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
                      {item.title}
                    </h3>
                    <div className="text-xs text-gray-600 mt-1 space-x-2">
                      {item.author && <span>{item.author}</span>}
                      {item.publishedAt && (
                        <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                      )}
                      {!item.author && !item.publishedAt && <span>未知时间</span>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                暂无最新播客
              </div>
            )}
          </div>

          {/* 最热 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">最热</h2>
            {loading.hot ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : hot.length > 0 ? (
              <div className="space-y-3">
                {hot.map((item) => (
                  <Link
                    key={item.id}
                    href={`/podcast/${item.id}`}
                    className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
                      {item.title}
                    </h3>
                    <div className="text-xs text-gray-600 mt-1 space-x-2">
                      {item.author && <span>{item.author}</span>}
                      {item.publishedAt && (
                        <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                      )}
                      {!item.author && !item.publishedAt && <span>未知时间</span>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                暂无热门播客
              </div>
            )}
          </div>

        </div>

        {/* 所有播客展开区域 */}
        <div className="mt-8">
          <button
            onClick={handleShowAllPodcasts}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>{showAllPodcasts ? '收起' : '所有播客'}</span>
            <svg 
              className={`w-4 h-4 transition-transform ${showAllPodcasts ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAllPodcasts && (
            <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">所有播客</h2>
              
              {/* 主题筛选器 */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-medium text-gray-700">按主题筛选：</span>
                  <select
                    value={selectedTopic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    <option value="">全部主题</option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.name}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                  {selectedTopic && (
                    <button
                      onClick={() => handleTopicChange('')}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
                    >
                      清除筛选
                    </button>
                  )}
                </div>
                {selectedTopic && (
                  <div className="text-sm text-gray-600">
                    当前筛选：<span className="font-medium text-gray-900">{selectedTopic}</span>
                  </div>
                )}
              </div>
              
              {loading.allPodcasts ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {allPodcasts.map((item) => (
                      <Link
                        key={item.id}
                        href={`/podcast/${item.id}`}
                        className="block p-3 rounded-lg hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-600">
                          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '未知时间'}
                        </p>
                      </Link>
                    ))}
                  </div>

                  {/* 分页 */}
                  {allPodcastsTotal > 10 && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        共 {allPodcastsTotal} 个播客，第 {allPodcastsPage} 页
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePageChange(allPodcastsPage - 1)}
                          disabled={allPodcastsPage <= 1}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          上一页
                        </button>
                        <button
                          onClick={() => handlePageChange(allPodcastsPage + 1)}
                          disabled={allPodcastsPage * 10 >= allPodcastsTotal}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
