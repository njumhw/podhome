"use client";

import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label?: string }) {
	const [copied, setCopied] = useState(false);
	async function onCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch {}
	}
	return (
		<button onClick={onCopy} className="px-3 py-2 text-sm rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10">
			{copied ? "已复制" : label ?? "一键复制"}
		</button>
	);
}
