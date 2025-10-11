"use client";

import { useState, useEffect } from 'react';

type Prompt = {
  id: string;
  name: string;
  description?: string;
  content: string;
  category: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PromptFormData = {
  name: string;
  description: string;
  content: string;
  category: string;
};

export function PromptManager() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<PromptFormData>({
    name: '',
    description: '',
    content: '',
    category: ''
  });
  const [saving, setSaving] = useState(false);

  // 预定义的提示词类别
  const categories = [
    { value: 'report_generation', label: '报告生成' },
    { value: 'transcript_cleaning', label: '转录清理' },
    { value: 'final_integration', label: '最终整合' },
    { value: 'other', label: '其他' }
  ];

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const response = await fetch('/api/admin/prompts');
      const data = await response.json();
      if (data.success) {
        setPrompts(data.prompts);
      }
    } catch (error) {
      console.error('Failed to load prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      content: '',
      category: ''
    });
    setEditingPrompt(null);
    setShowCreateForm(true);
  };

  const handleEdit = (prompt: Prompt) => {
    setFormData({
      name: prompt.name,
      description: prompt.description || '',
      content: prompt.content,
      category: prompt.category
    });
    setEditingPrompt(prompt);
    setShowCreateForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.content || !formData.category) {
      alert('请填写所有必填字段');
      return;
    }

    setSaving(true);
    try {
      const url = editingPrompt ? '/api/admin/prompts' : '/api/admin/prompts';
      const method = editingPrompt ? 'PUT' : 'POST';
      const body = editingPrompt 
        ? { id: editingPrompt.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.success) {
        await loadPrompts();
        setShowCreateForm(false);
        setEditingPrompt(null);
        alert(editingPrompt ? '提示词更新成功' : '提示词创建成功');
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
      alert('操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除提示词 "${name}" 吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/prompts?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        await loadPrompts();
        alert('提示词删除成功');
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      alert('删除失败');
    }
  };

  const handleToggleActive = async (prompt: Prompt) => {
    try {
      const response = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: prompt.id,
          isActive: !prompt.isActive
        })
      });

      const data = await response.json();
      if (data.success) {
        await loadPrompts();
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to toggle prompt:', error);
      alert('操作失败');
    }
  };

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 标题和创建按钮 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">提示词管理</h2>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          创建新提示词
        </button>
      </div>

      {/* 提示词列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  类别
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  版本
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  更新时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {prompts.map((prompt) => (
                <tr key={prompt.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{prompt.name}</div>
                      {prompt.description && (
                        <div className="text-sm text-gray-500">{prompt.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {categories.find(c => c.value === prompt.category)?.label || prompt.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(prompt)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        prompt.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {prompt.isActive ? '启用' : '禁用'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    v{prompt.version}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(prompt.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(prompt.id, prompt.name)}
                      className="text-red-600 hover:text-red-900"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 创建/编辑表单 */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPrompt ? '编辑提示词' : '创建新提示词'}
              </h3>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="提示词名称"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    类别 *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">选择类别</option>
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="提示词描述"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    内容 *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={15}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="提示词内容"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={saving}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
