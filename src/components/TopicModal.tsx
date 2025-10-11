'use client';

import { useState, useEffect } from 'react';

interface Topic {
  id: string;
  name: string;
  description?: string;
  color?: string;
  _count?: {
    podcasts: number;
  };
}

interface TopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  podcastId: string;
  currentTopic?: Topic | null;
  onTopicChange: (topic: Topic | null) => void;
}

export default function TopicModal({ 
  isOpen, 
  onClose, 
  podcastId, 
  currentTopic, 
  onTopicChange 
}: TopicModalProps) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  // 预设的专题颜色，与应用气质相符
  const presetColors = [
    { name: '深蓝', value: '#1E40AF', bg: 'bg-blue-800', text: 'text-white' },
    { name: '墨绿', value: '#065F46', bg: 'bg-emerald-800', text: 'text-white' },
    { name: '深紫', value: '#6B21A8', bg: 'bg-purple-800', text: 'text-white' },
    { name: '深红', value: '#991B1B', bg: 'bg-red-800', text: 'text-white' },
    { name: '深橙', value: '#C2410C', bg: 'bg-orange-800', text: 'text-white' },
    { name: '深灰', value: '#374151', bg: 'bg-gray-700', text: 'text-white' },
    { name: '深青', value: '#0F766E', bg: 'bg-teal-800', text: 'text-white' },
    { name: '深靛', value: '#3730A3', bg: 'bg-indigo-800', text: 'text-white' },
    { name: '深粉', value: '#BE185D', bg: 'bg-pink-800', text: 'text-white' },
    { name: '深黄', value: '#92400E', bg: 'bg-yellow-800', text: 'text-white' }
  ];

  const [newTopic, setNewTopic] = useState({
    name: '',
    description: '',
    color: presetColors[0].value
  });

  useEffect(() => {
    if (isOpen) {
      loadTopics();
      setSelectedTopicId(currentTopic?.id || '');
    }
  }, [isOpen, currentTopic]);

  const loadTopics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/public/topics?includeCount=true');
      const data = await response.json();
      
      if (data.success) {
        setTopics(data.topics);
      }
    } catch (error) {
      console.error('加载主题失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // 立即更新UI，提供即时反馈
      const selectedTopic = selectedTopicId ? 
        topics.find(t => t.id === selectedTopicId) || null : null;
      onTopicChange(selectedTopic);
      
      const response = await fetch('/api/podcast/topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podcastId,
          topicId: selectedTopicId || null
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // 成功时关闭模态框
        onClose();
      } else {
        // 失败时回滚UI状态
        onTopicChange(currentTopic);
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      // 失败时回滚UI状态
      onTopicChange(currentTopic);
      alert('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!newTopic.name.trim()) {
      alert('请输入主题名称');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTopic)
      });

      const data = await response.json();
      
      if (data.success) {
        alert('主题创建成功，等待审核通过后即可使用');
        setShowCreateForm(false);
        setNewTopic({ name: '', description: '', color: '#3B82F6' });
        loadTopics();
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('创建失败:', error);
      alert('创建失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">选择专题</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!showCreateForm ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-800 mb-2">
                当前专题
              </label>
              <div className="text-sm text-gray-700 mb-3">
                {currentTopic ? (
                  <span 
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: currentTopic.color + '20',
                      color: currentTopic.color 
                    }}
                  >
                    {currentTopic.name}
                  </span>
                ) : (
                  '未设置专题'
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-800 mb-2">
                选择专题
              </label>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                disabled={loading}
              >
                <option value="">不设置专题</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name} ({topic._count?.podcasts || 0}个播客)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors duration-200"
              >
                {loading ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 transition-colors duration-200"
              >
                新建专题
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-800 mb-2">
                专题名称 *
              </label>
              <input
                type="text"
                value={newTopic.name}
                onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="请输入专题名称"
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-800 mb-2">
                专题描述
              </label>
              <textarea
                value={newTopic.description}
                onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                rows={3}
                placeholder="请输入专题描述（可选）"
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-800 mb-3">
                专题颜色
              </label>
              <div className="grid grid-cols-5 gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewTopic({ ...newTopic, color: color.value })}
                    className={`w-full h-10 rounded-md border-2 transition-all duration-200 ${
                      newTopic.color === color.value
                        ? 'border-gray-900 ring-2 ring-gray-300'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    disabled={loading}
                  >
                    <span className="text-xs text-white font-medium">{color.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">选择专题标识颜色</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateTopic}
                disabled={loading || !newTopic.name.trim()}
                className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors duration-200"
              >
                {loading ? '创建中...' : '创建专题'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 hover:border-gray-400 disabled:opacity-50 transition-colors duration-200"
              >
                取消
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
