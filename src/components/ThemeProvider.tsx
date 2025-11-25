"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
	theme: Theme;
	toggleTheme: () => void;
	setTheme: (theme: Theme) => void;
	mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): Theme {
	if (typeof window === "undefined") return "dark";
	const stored = window.localStorage.getItem("podroom-theme");
	if (stored === "dark" || stored === "light") return stored;
	const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
	return prefersLight ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>("dark");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setThemeState(getInitialTheme());
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) return;
		const root = document.documentElement;
		root.dataset.theme = theme;
		window.localStorage.setItem("podroom-theme", theme);
	}, [theme, mounted]);

	const toggleTheme = () =>
		setThemeState((prev) => (prev === "dark" ? "light" : "dark"));

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			toggleTheme,
			setTheme: setThemeState,
			mounted,
		}),
		[theme, mounted]
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within ThemeProvider");
	}
	return context;
}

