"use client";

import { useState } from "react";

export function QAGlobal({ onAsk }: { onAsk: (q: string) => void }) {
	const [q, setQ] = useState("");
	return (
		<div className="w-full max-w-2xl mx-auto space-y-2">
			<p className="text-xs text-gray-500 dark:text-gray-400">
				这是一个播客内容 Agent，只会基于逐字稿原文回答。
			</p>
			<div className="flex items-center gap-2">
				<input
					type="text"
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="提出你的问题…"
					className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
				/>
				<button
					onClick={() => q.trim() && onAsk(q.trim())}
					className="px-3 py-2 text-sm rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
					disabled={!q.trim()}
				>
					提问
				</button>
			</div>
		</div>
	);
}
