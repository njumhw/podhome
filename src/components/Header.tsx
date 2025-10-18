"use client";

import { useState, useEffect } from "react";
import SimpleProcessingStatus from "./SimpleProcessingStatus";
import { AboutModal } from "./AboutModal";
import { useUser } from "@/hooks/useUser";

export function Header() {
	const { user, dailyUsage, isLoading } = useUser();
	const [showProcessingStatus, setShowProcessingStatus] = useState(false);
	const [showAboutModal, setShowAboutModal] = useState(false);
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
		await fetch("/api/auth/logout", { method: "POST" });
		setUser(null);
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
			<header className="w-full sticky top-0 z-10 bg-white/70 dark:bg-black/50 backdrop-blur border-b border-black/10 dark:border-white/10">
				<div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
					<h1 className="text-xl font-semibold tracking-tight">PodHome</h1>
					<nav className="flex items-center gap-4">
						{/* 处理状态图标 */}
						{processingCount > 0 && (
							<button
								onClick={() => setShowProcessingStatus(true)}
								className="relative p-2 text-blue-600 hover:text-blue-700 transition-colors"
								title="正在处理的播客"
							>
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								<span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
									{processingCount}
								</span>
							</button>
						)}
						
					{isLoading ? (
						<div className="text-sm text-gray-600 dark:text-gray-300">加载中...</div>
					) : user ? (
						<div className="flex items-center gap-4">
							{/* 用户信息区域 */}
							<div className="flex items-center gap-2">
								{/* 今日额度显示 */}
								{dailyUsage.limit > 0 && (
									<div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
										今日额度：{dailyUsage.used}/{dailyUsage.limit}
									</div>
								)}
								{dailyUsage.limit === -1 && (
									<div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
										今日额度：{dailyUsage.used}/∞
									</div>
								)}
								{/* 用户名 */}
								<span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
									{user.username}
								</span>
							</div>
							
							{/* 分隔线 */}
							<div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
							
							{/* 导航链接 */}
							<div className="flex items-center gap-3">
								{/* 关于我们按钮 */}
								<button
									onClick={() => setShowAboutModal(true)}
									className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
								>
									关于我们
								</button>
								
								{/* 退出按钮 */}
								<button
									onClick={handleLogout}
									className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
								>
									退出
								</button>
							</div>
						</div>
					) : (
							<div className="flex items-center gap-4">
								{/* 关于我们按钮 - 游客也可访问 */}
								<button
									onClick={() => setShowAboutModal(true)}
									className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
								>
									关于我们
								</button>
								
								{/* 分隔线 */}
								<div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
								
								{/* 登录注册 */}
								<div className="flex items-center gap-3">
									<a
										href="/login"
										className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
									>
										登录
									</a>
									<a
										href="/register"
										className="text-sm px-3 py-1 rounded-xl bg-black text-white dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
									>
										注册
									</a>
								</div>
							</div>
						)}
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
			/>
		</>
	);
}
