"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
	const { theme, toggleTheme, mounted } = useTheme();

	if (!mounted) return null;

	const isDark = theme === "dark";

	return (
		<button
			onClick={toggleTheme}
			className="theme-toggle-btn inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-mono transition-all hover:shadow-[0_8px_15px_-10px_rgba(255,140,50,0.55)]"
			aria-label="Toggle theme"
		>
			<span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
				{isDark ? (
					<svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0-1.414-1.414M7.05 7.05 5.636 5.636" />
					</svg>
				) : (
					<svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z" />
					</svg>
				)}
			</span>
			<span>{isDark ? "Dark" : "Light"} mode</span>
		</button>
	);
}

