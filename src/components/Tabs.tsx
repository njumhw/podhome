"use client";

import { useState } from "react";

const tabs = [
	{ key: "latest", label: "最新" },
	{ key: "hot", label: "最热" },
	{ key: "topics", label: "主题" },
];

export type TabKey = typeof tabs[number]["key"];

export function Tabs({ onChange }: { onChange: (key: TabKey) => void }) {
	const [active, setActive] = useState<TabKey>("latest");
	return (
		<div className="inline-flex rounded-xl border border-black/10 dark:border-white/10 p-1 bg-white/60 dark:bg-black/40 backdrop-blur">
			{tabs.map((t) => {
				const isActive = t.key === active;
				return (
					<button
						key={t.key}
						onClick={() => {
							setActive(t.key);
							onChange(t.key);
						}}
						className={
							"px-3.5 py-1.5 text-sm rounded-lg transition-colors " +
							(isActive
								? "bg-black text-white dark:bg-white dark:text-black"
								: "text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10")
						}
					>
						{t.label}
					</button>
				);
			})}
		</div>
	);
}
