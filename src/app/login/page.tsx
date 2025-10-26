"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
	const [formData, setFormData] = useState({
		identifier: "",
		password: "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const router = useRouter();
	const searchParams = useSearchParams();
	const message = searchParams.get("message");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		setIsLoading(true);

		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formData),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || "登录失败");
			}

			// 登录成功，刷新页面并跳转到首页
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
					<h1 className="text-2xl font-semibold tracking-tight mb-2">登录 PodHome</h1>
					<p className="text-sm text-gray-700 dark:text-gray-300">
						欢迎回到播客内容转写平台
					</p>
				</div>

				{message && (
					<div className="mb-4 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
						{message}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-2">邮箱或用户名</label>
						<input
							type="text"
							required
							value={formData.identifier}
							onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
							className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/40 backdrop-blur px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20"
							placeholder="邮箱或用户名"
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
							placeholder="密码"
						/>
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
						{isLoading ? "登录中..." : "登录"}
					</button>
				</form>

				<div className="mt-6 text-center">
					<p className="text-sm text-gray-700 dark:text-gray-300">
						还没有账号？{" "}
						<a href="/register" className="text-black dark:text-white hover:underline">
							立即注册
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<LoginForm />
		</Suspense>
	);
}
