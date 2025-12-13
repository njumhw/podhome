"use client";

/**
 * MuleRun 测试页面
 * 用于本地测试 MuleRun Session 页面，模拟 MuleRun 平台的签名参数
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MulerunTestPage() {
  const router = useRouter();
  const [agentKey, setAgentKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 从环境变量或用户输入获取 Agent Key
    // 注意：在实际使用中，Agent Key 应该从服务器端获取，这里仅用于测试
    const stored = localStorage.getItem('mulerun_test_agent_key');
    if (stored) {
      setAgentKey(stored);
    }
  }, []);

  const generateTestParams = async () => {
    if (!agentKey) {
      alert('请先输入 Agent Key');
      return;
    }

    setLoading(true);

    try {
      // 调用 API 生成签名
      const res = await fetch('/api/mulerun/test-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`生成签名失败: ${data.error}`);
        setLoading(false);
        return;
      }

      // 保存 Agent Key 到 localStorage
      localStorage.setItem('mulerun_test_agent_key', agentKey);

      // 跳转到 Session 页面（在开发模式下，可以通过 URL 参数传递 Agent Key）
      // 注意：这只是为了本地测试，生产环境应该使用环境变量
      const url = process.env.NODE_ENV === 'development' 
        ? `/mulerun/session?${data.queryString}&_test_agent_key=${encodeURIComponent(agentKey)}`
        : `/mulerun/session?${data.queryString}`;
      router.push(url);
    } catch (error) {
      console.error('生成测试参数失败:', error);
      alert('生成测试参数失败，请检查控制台');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          MuleRun 测试工具
        </h1>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agent Key（从 .env 文件中的 MULERUN_AGENT_KEY 复制）
          </label>
          <input
            type="text"
            value={agentKey}
            onChange={(e) => setAgentKey(e.target.value)}
            placeholder="mck-xxxxxxxxxxxxxxxxxxxxx"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-sm text-gray-500">
            这个值应该与你的 .env 文件中的 MULERUN_AGENT_KEY 一致
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-blue-900 mb-2">
            ⚠️ 注意事项
          </h2>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>这个工具仅用于本地测试</li>
            <li>Agent Key 会保存在浏览器的 localStorage 中</li>
            <li>实际使用时，签名参数由 MuleRun 平台自动生成</li>
            <li>确保 Agent Key 与服务器 .env 文件中的值一致</li>
          </ul>
        </div>

        <button
          onClick={generateTestParams}
          disabled={!agentKey || loading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? '生成中...' : '生成测试参数并跳转到 Session 页面'}
        </button>

        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            使用说明：
          </h3>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>从你的 .env 文件中复制 MULERUN_AGENT_KEY 的值</li>
            <li>粘贴到上面的输入框</li>
            <li>点击按钮生成测试参数</li>
            <li>会自动跳转到 MuleRun Session 页面进行测试</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

