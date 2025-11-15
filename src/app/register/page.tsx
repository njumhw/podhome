"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
	const [formData, setFormData] = useState({
		email: "",
		username: "",
		password: "",
		confirmPassword: "",
		inviteCode: "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		// 验证表单
		if (formData.password !== formData.confirmPassword) {
			setError("密码不匹配");
			return;
		}

		if (formData.password.length < 8) {
			setError("密码至少需要8位");
			return;
		}

		setIsLoading(true);

		try {
			const res = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: formData.email,
					username: formData.username,
					password: formData.password,
					inviteCode: formData.inviteCode,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || "注册失败");
			}

			// 注册成功，直接跳转到首页（已自动登录）
			window.location.href = "/";
		} catch (err: any) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
			<div className="w-full max-w-md p-8">
				<div className="text-center mb-8">
					<h1 className="text-2xl font-semibold tracking-tight mb-2">注册 PodHome</h1>
					<p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
						加入播客内容转写平台
					</p>
					<div className="inline-flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg">
						<span>✨ 每天可转录2个播客链接</span>
						<span>💬 参与评论互动</span>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-2">邮箱</label>
						<input
							type="email"
							required
							value={formData.email}
							onChange={(e) => setFormData({ ...formData, email: e.target.value })}
							className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							placeholder="your@email.com"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium mb-2">用户名</label>
						<input
							type="text"
							required
							value={formData.username}
							onChange={(e) => setFormData({ ...formData, username: e.target.value })}
							className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							placeholder="用户名"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium mb-2">密码</label>
						<input
							type="password"
							required
							value={formData.password}
							onChange={(e) => setFormData({ ...formData, password: e.target.value })}
							className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							placeholder="至少8位密码"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium mb-2">确认密码</label>
						<input
							type="password"
							required
							value={formData.confirmPassword}
							onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
							className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							placeholder="再次输入密码"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium mb-2">邀请码</label>
						<input
							type="text"
							required
							value={formData.inviteCode}
							onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
							className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							placeholder="请输入邀请码"
						/>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
							请联系 阿茅（Wechat：njumwh）获取邀请码
						</p>
					</div>

					{error && (
						<div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={isLoading}
						className="w-full px-4 py-2 text-sm rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isLoading ? "注册中..." : "注册"}
					</button>
				</form>

				<div className="mt-6 text-center">
					<p className="text-sm text-gray-700 dark:text-gray-300">
						已有账号？{" "}
						<a href="/login" className="text-black dark:text-white hover:underline">
							立即登录
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}
