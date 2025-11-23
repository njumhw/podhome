// 统一的总结显示组件
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SummaryDisplayProps {
  summary?: string | null;
  report?: string | null; // 保持向后兼容，但内部只使用summary
  className?: string;
  style?: React.CSSProperties;
  showMarkdown?: boolean;
  fallbackText?: string;
}

export function SummaryDisplay({ 
  summary, 
  report, 
  className = "", 
  style = {},
  showMarkdown = true,
  fallbackText = "总结内容暂未生成。"
}: SummaryDisplayProps) {
  // 统一的总结内容获取逻辑 - 优先使用summary字段
  const content = summary || report;
  
  if (!content) {
    return (
      <div className={`text-zinc-500 text-center py-8 font-mono text-sm ${className}`} style={style}>
        {fallbackText}
      </div>
    );
  }
  
  if (showMarkdown) {
    return (
      <div 
        className={`max-w-none overflow-y-auto overflow-x-hidden ${className}`}
        style={{ 
          wordWrap: 'break-word', 
          overflowWrap: 'break-word',
          lineHeight: '1.7',
          ...style 
        }}
        onWheel={(e) => {
          e.stopPropagation();
        }}
      >
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p className="text-zinc-300 text-base leading-7 mb-4 font-sans">
                {children}
              </p>
            ),
            li: ({ children }) => (
              <li className="text-zinc-300 text-base leading-7 mb-2 font-sans">
                {children}
              </li>
            ),
            h1: ({ children }) => (
              <h1 className="text-white text-2xl font-bold mb-5 mt-6 font-sans">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-white text-xl font-bold mb-4 mt-5 font-sans">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-white text-lg font-bold mb-3 mt-4 font-sans">
                {children}
              </h3>
            ),
            strong: ({ children }) => (
              <strong className="text-white font-semibold">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="text-zinc-300 italic">
                {children}
              </em>
            ),
            blockquote: ({ children }) => (
              <blockquote className="text-zinc-400 text-base leading-7 border-l-4 border-white/20 pl-4 my-4 italic">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="text-zinc-300 text-sm bg-zinc-900/40 px-1.5 py-0.5 rounded font-mono">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="text-zinc-300 text-sm bg-zinc-900/40 p-4 rounded-lg font-mono overflow-auto my-4">
                {children}
              </pre>
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }
  
  // 纯文本显示
  return (
    <div 
      className={`whitespace-pre-wrap ${className}`}
      style={style}
    >
      {content}
    </div>
  );
}

// 获取总结内容的工具函数
export function getSummaryContent(summary?: string | null, report?: string | null): string | null {
  return summary || report || null;
}

// 检查是否有总结内容的工具函数
export function hasSummaryContent(summary?: string | null, report?: string | null): boolean {
  return !!(summary || report);
}
