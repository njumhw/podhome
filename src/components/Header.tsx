"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SimpleProcessingStatus from "./SimpleProcessingStatus";
import { AboutModal } from "./AboutModal";
import { ThemeToggle } from "./ThemeToggle";
import { UserStatusBadge } from "./UserStatusBadge";
import { useUser } from "@/hooks/useUser";

export function Header() {
	const { user, dailyUsage, isLoading, updateUser } = useUser();
	const [showProcessingStatus, setShowProcessingStatus] = useState(false);
	const [showAboutModal, setShowAboutModal] = useState(false);
	const [aboutModalInitialTab, setAboutModalInitialTab] = useState<'about' | 'permissions'>('about');
	const [processingCount, setProcessingCount] = useState(0);

	useEffect(() => {
		// 如果是管理员，在 footer 中添加管理后台链接
		if (user?.role === "ADMIN") {
			addAdminFooterLink();
		} else {
			removeAdminFooterLink();
		}
		
		// 监听页面可见性变化，重新检查用户状态
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				updateProcessingCount(); // 页面重新获得焦点时也更新处理状态
			}
		};
		
		// 监听处理状态变化
		const updateProcessingCount = () => {
			const stored = localStorage.getItem('processingPodcasts');
			if (stored) {
				try {
					const items = JSON.parse(stored);
					// 只显示进行中的项目数量（用于红色标签）
					const processingItems = items.filter((item: any) => 
						item.status === 'processing'
					);
					setProcessingCount(processingItems.length);
				} catch (error) {
					setProcessingCount(0);
				}
			} else {
				setProcessingCount(0);
			}
		};
		
		updateProcessingCount();
		
		// 监听localStorage变化
		const handleStorageChange = () => {
			updateProcessingCount();
		};
		
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('storage', handleStorageChange);
		
		// 定期检查处理状态
		const interval = setInterval(() => {
			updateProcessingCount();
		}, 5000); // 每5秒检查一次
		
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('storage', handleStorageChange);
			clearInterval(interval);
		};
	}, [user]);

	const handleLogout = async () => {
		await fetch("/api/auth/logout", { 
			method: "POST",
			credentials: "include", // 确保发送 Cookie
		});
		updateUser(null);
		removeAdminFooterLink();
		window.location.reload();
	};

	// 在 footer 中添加管理后台链接
	const addAdminFooterLink = () => {
		const footerLinkContainer = document.getElementById('admin-footer-link');
		if (footerLinkContainer && !footerLinkContainer.querySelector('a')) {
			footerLinkContainer.innerHTML = `
				<span class="mx-2">·</span>
				<a 
					href="/admin" 
					class="text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
				>
					管理后台
				</a>
			`;
		}
	};

	// 移除 footer 中的管理后台链接
	const removeAdminFooterLink = () => {
		const footerLinkContainer = document.getElementById('admin-footer-link');
		if (footerLinkContainer) {
			footerLinkContainer.innerHTML = '';
		}
	};

	return (
		<>
			<header className="header-shell w-full sticky top-0 z-[100] backdrop-blur-sm relative">
				<div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-4">
					<Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
						<h1 className="text-xl font-bold tracking-tight flex items-center gap-1.5">
							<span className="text-white dark:text-white [data-theme='light']:text-foreground font-sans">Podcast</span>
							<span className="font-serif italic text-lg text-zinc-600 dark:text-zinc-600 [data-theme='light']:text-slate-700 font-light">to</span>
								<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffd48f] via-[#ff9f43] to-[#ff6a00] font-sans">
								Insight
							</span>
						</h1>
					</Link>
					<nav className="flex items-center gap-4">
						{/* 处理状态图标 */}
						{processingCount > 0 && (
							<button
								onClick={() => setShowProcessingStatus(true)}
								className="relative p-2 text-blue-400 hover:text-blue-300 transition-colors"
								title="正在处理的播客"
							>
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								<span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-mono">
									{processingCount}
								</span>
							</button>
						)}
						
					{isLoading ? (
						<div className="text-sm text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 font-mono">加载中...</div>
					) : (
						<div className="flex items-center gap-4">
							{/* 用户状态徽章 - 所有用户都显示 */}
							{user ? (
								(() => {
									// 将数据库角色映射到组件角色
									let badgeRole: 'visitor' | 'reader' | 'podcaster' | 'vip' | 'admin' = 'visitor';
									if (user.role === 'ADMIN') badgeRole = 'admin';
									else if (user.role === 'PODCASTER_VIP') badgeRole = 'vip';
									else if (user.role === 'PODCASTER' || user.role === 'USER') badgeRole = 'podcaster'; // USER 已迁移为 PODCASTER
									else if (user.role === 'READER') badgeRole = 'reader';
									else if (user.role === 'GUEST') badgeRole = 'visitor'; // GUEST 视为 visitor
									// 其他未知角色默认为 visitor
									
									return (
										<UserStatusBadge 
											role={badgeRole} 
											onClick={() => {
												setAboutModalInitialTab('permissions');
												setShowAboutModal(true);
											}}
										/>
									);
								})()
							) : (
								<UserStatusBadge 
									role="visitor" 
									onClick={() => {
										setAboutModalInitialTab('permissions');
										setShowAboutModal(true);
									}}
								/>
							)}
							
							{/* 用户信息区域 - 仅登录用户显示 */}
							{user && (
								<div className="flex items-center gap-2">
								{/* 今日额度显示 */}
								{dailyUsage.limit > 0 && (
									<div className="text-xs text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-slate-100 border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-200 px-2 py-1 rounded font-mono">
										今日额度：{dailyUsage.used}/{dailyUsage.limit}
									</div>
								)}
								{dailyUsage.limit === -1 && (
									<div className="text-xs text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-slate-100 border border-white/10 dark:border-white/10 [data-theme='light']:border-slate-200 px-2 py-1 rounded font-mono">
										今日额度：{dailyUsage.used}/∞
									</div>
								)}
									{/* 用户名 */}
									<span className="text-sm text-white dark:text-white [data-theme='light']:text-foreground font-medium">
										{user.username}
									</span>
								</div>
							)}
							
							{/* 分隔线 - 仅登录用户显示 */}
							{user && (
								<div className="w-px h-4 bg-white/10 dark:bg-white/10 [data-theme='light']:bg-slate-200"></div>
							)}
							
							{/* 导航链接 */}
							<div className="flex items-center gap-3">
								{/* 关于我们按钮 */}
								<button
									onClick={() => {
										setAboutModalInitialTab('about');
										setShowAboutModal(true);
									}}
									className="text-sm text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 hover:text-white dark:hover:text-white [data-theme='light']:hover:text-foreground transition-colors font-mono"
								>
									{user ? '关于我们' : 'About Us'}
								</button>
								
								{user ? (
									/* 退出按钮 - 仅登录用户 */
									<button
										onClick={handleLogout}
										className="text-sm text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 hover:text-white dark:hover:text-white [data-theme='light']:hover:text-foreground transition-colors font-mono"
									>
										退出
									</button>
								) : (
									/* Login & Register - 仅访客显示 */
									<>
										{/* Separator */}
										<div className="w-px h-4 bg-white/10 dark:bg-white/10 [data-theme='light']:bg-slate-200"></div>
										
										<a
											href="/login"
											className="text-sm text-gray-400 dark:text-gray-400 [data-theme='light']:text-slate-600 hover:text-white dark:hover:text-white [data-theme='light']:hover:text-foreground transition-colors font-mono"
										>
											Login
										</a>
										<a
											href="/register"
											className="text-sm px-3 py-1 rounded-lg bg-blue-500/20 dark:bg-blue-500/20 [data-theme='light']:bg-blue-500 text-blue-400 dark:text-blue-400 [data-theme='light']:text-white border border-blue-500/50 dark:border-blue-500/50 [data-theme='light']:border-blue-600 hover:bg-blue-500/30 dark:hover:bg-blue-500/30 [data-theme='light']:hover:bg-blue-600 transition-colors font-mono"
										>
											Register
										</a>
									</>
								)}
							</div>
						</div>
					)}
						{/* 主题切换按钮 - 放在最右边 */}
						<ThemeToggle />
					</nav>
				</div>
			</header>
			
			<SimpleProcessingStatus 
				isVisible={showProcessingStatus} 
				onClose={() => setShowProcessingStatus(false)}
				onCancel={async (id) => {
					try {
						const response = await fetch('/api/process-audio/cancel', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ processingId: id })
						});
						
						if (response.ok) {
							// 更新本地状态
							const stored = localStorage.getItem('processingPodcasts');
							if (stored) {
								const items = JSON.parse(stored);
								const updatedItems = items.map((item: any) => 
									item.id === id 
										? { ...item, status: 'failed', error: '用户取消' }
										: item
								);
								localStorage.setItem('processingPodcasts', JSON.stringify(updatedItems));
								window.dispatchEvent(new Event('storage'));
							}
						}
					} catch (error) {
						console.error('取消处理失败:', error);
					}
				}}
			/>
			
			<AboutModal 
				isVisible={showAboutModal} 
				onClose={() => setShowAboutModal(false)}
				initialTab={aboutModalInitialTab}
			/>
		</>
	);
}
