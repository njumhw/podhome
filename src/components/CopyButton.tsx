"use client";

import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label?: string }) {
	const [copied, setCopied] = useState(false);
	
	async function onCopy() {
		// 优先使用现代 Clipboard API（需要 HTTPS 或 localhost）
		if (navigator.clipboard && window.isSecureContext) {
			try {
				await navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => setCopied(false), 1200);
				return;
			} catch (err) {
				console.warn('Clipboard API 失败，尝试降级方案:', err);
				// 继续尝试降级方案
			}
		}
		
		// 降级方案：使用传统的 execCommand 方法（适用于 HTTP 环境）
		try {
			// 创建一个临时的 textarea 元素
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.left = '-999999px';
			textarea.style.top = '-999999px';
			document.body.appendChild(textarea);
			textarea.focus();
			textarea.select();
			
			// 尝试复制
			const successful = document.execCommand('copy');
			document.body.removeChild(textarea);
			
			if (successful) {
				setCopied(true);
				setTimeout(() => setCopied(false), 1200);
			} else {
				throw new Error('execCommand 复制失败');
			}
		} catch (err) {
			console.error('复制失败:', err);
			// 如果所有方法都失败，至少给用户反馈
			alert('复制失败，请手动选择文本复制（Ctrl+C 或 Cmd+C）');
		}
	}
	
	return (
		<button onClick={onCopy} className="px-3 py-2 text-sm rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10">
			{copied ? "已复制" : label ?? "一键复制"}
		</button>
	);
}
