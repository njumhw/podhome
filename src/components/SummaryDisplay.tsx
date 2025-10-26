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
      <div className={`text-gray-600 text-center py-8 ${className}`} style={style}>
        {fallbackText}
      </div>
    );
  }
  
  if (showMarkdown) {
    return (
      <div 
        className={`max-w-none overflow-y-auto overflow-x-hidden border border-gray-200 rounded-lg p-4 ${className}`}
        style={{ 
          height: '900px', // 提高默认高度
          wordWrap: 'break-word', 
          overflowWrap: 'break-word',
          backgroundColor: '#ffffff',
          color: '#1f2937',
          lineHeight: '1.4',
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
              <p style={{ 
                wordWrap: 'break-word', 
                overflowWrap: 'break-word', 
                whiteSpace: 'normal', 
                color: '#111827', 
                fontSize: '14px', 
                lineHeight: '1.3',
                margin: '0 0 8px 0',
                textDecoration: 'none'
              }}>
                {children}
              </p>
            ),
            li: ({ children }) => (
              <li style={{ 
                wordWrap: 'break-word', 
                overflowWrap: 'break-word', 
                color: '#111827', 
                fontSize: '14px', 
                lineHeight: '1.3',
                margin: '0 0 2px 0',
                textDecoration: 'none'
              }}>
                {children}
              </li>
            ),
            h1: ({ children }) => (
              <h1 style={{ 
                color: '#111827', 
                fontSize: '18px', 
                fontWeight: 'bold', 
                lineHeight: '1.2',
                marginBottom: '6px', 
                marginTop: '8px',
                textDecoration: 'none'
              }}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 style={{ 
                color: '#111827', 
                fontSize: '16px', 
                fontWeight: 'bold', 
                lineHeight: '1.2',
                marginBottom: '4px', 
                marginTop: '6px',
                textDecoration: 'none'
              }}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 style={{ 
                color: '#111827', 
                fontSize: '15px', 
                fontWeight: 'bold', 
                lineHeight: '1.2',
                marginBottom: '2px', 
                marginTop: '4px',
                textDecoration: 'none'
              }}>
                {children}
              </h3>
            ),
            strong: ({ children }) => (
              <strong style={{ 
                wordWrap: 'break-word', 
                overflowWrap: 'break-word', 
                color: '#111827', 
                fontSize: '14px', 
                lineHeight: '1.3',
                fontWeight: 'bold',
                textDecoration: 'none'
              }}>
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em style={{ 
                wordWrap: 'break-word', 
                overflowWrap: 'break-word', 
                color: '#111827', 
                fontSize: '14px', 
                lineHeight: '1.3',
                fontStyle: 'italic',
                textDecoration: 'none'
              }}>
                {children}
              </em>
            ),
            blockquote: ({ children }) => (
              <blockquote style={{ 
                wordWrap: 'break-word', 
                overflowWrap: 'break-word', 
                color: '#374151', 
                fontSize: '14px', 
                lineHeight: '1.3',
                borderLeft: '4px solid #e5e7eb',
                paddingLeft: '16px',
                margin: '4px 0',
                backgroundColor: '#f9fafb',
                textDecoration: 'none'
              }}>
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code style={{ 
                color: '#111827', 
                fontSize: '13px', 
                backgroundColor: '#f3f4f6',
                padding: '2px 4px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                textDecoration: 'none'
              }}>
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre style={{ 
                color: '#111827', 
                fontSize: '13px', 
                backgroundColor: '#f3f4f6',
                padding: '12px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                overflow: 'auto',
                margin: '16px 0',
                textDecoration: 'none'
              }}>
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
