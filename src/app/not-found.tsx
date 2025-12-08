import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-4">页面未找到</h2>
      <p className="text-gray-400 mb-8 max-w-md">
        抱歉，您访问的页面不存在。可能是链接错误或页面已被移除。
      </p>
      <Link
        href="/home"
        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
      >
        返回首页
      </Link>
    </div>
  );
}

