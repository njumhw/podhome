"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
			setError("Passwords do not match");
			return;
		}

		if (formData.password.length < 8) {
			setError("Password must be at least 8 characters");
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
				throw new Error(data.error || "Registration failed");
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
		<div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
			{/* Aurora Glow Backgrounds */}
			<div className="hidden md:block absolute top-1/4 left-[10%] w-[300px] h-[300px] bg-white rounded-full blur-[120px] opacity-10 animate-pulse-slow pointer-events-none -z-10"></div>
			<div className="hidden md:block absolute bottom-1/4 right-[10%] w-[300px] h-[300px] bg-purple-600 rounded-full blur-[120px] opacity-20 animate-pulse-slow pointer-events-none -z-10" style={{ animationDelay: '2s' }}></div>

			<div className="relative w-full max-w-md z-10">
				{/* Back to Home Link */}
				<Link 
					href="/" 
					className="absolute -top-16 left-0 flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors font-mono"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="m12 19-7-7 7-7"/>
						<path d="M19 12H5"/>
					</svg>
					Back to Home
				</Link>

				<div className="text-center mb-10">
					<h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 flex items-center justify-center gap-3">
						<span className="text-zinc-100 tracking-tighter font-sans">Podcast</span>
						<span className="font-serif italic text-2xl sm:text-3xl text-zinc-600 font-light">to</span>
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 font-sans">
							Insight
						</span>
					</h1>
					<p className="text-sm text-zinc-500 font-mono mb-4">
						Create your account and start exploring
					</p>
					<div className="inline-flex items-center gap-4 text-xs text-zinc-400 bg-zinc-900/40 border border-white/5 px-4 py-2 rounded-lg font-mono">
						<span>✨ 2 podcasts/day</span>
						<span>💬 Comments & interactions</span>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-5">
					<div>
						<label className="block text-xs font-mono text-zinc-400 mb-2 uppercase tracking-wider">Email</label>
						<input
							type="email"
							required
							value={formData.email}
							onChange={(e) => setFormData({ ...formData, email: e.target.value })}
							className="w-full rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-sans"
							placeholder="your@email.com"
						/>
					</div>

					<div>
						<label className="block text-xs font-mono text-zinc-400 mb-2 uppercase tracking-wider">Username</label>
						<input
							type="text"
							required
							value={formData.username}
							onChange={(e) => setFormData({ ...formData, username: e.target.value })}
							className="w-full rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-sans"
							placeholder="Choose a username"
						/>
					</div>

					<div>
						<label className="block text-xs font-mono text-zinc-400 mb-2 uppercase tracking-wider">Password</label>
						<input
							type="password"
							required
							value={formData.password}
							onChange={(e) => setFormData({ ...formData, password: e.target.value })}
							className="w-full rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-sans"
							placeholder="At least 8 characters"
						/>
					</div>

					<div>
						<label className="block text-xs font-mono text-zinc-400 mb-2 uppercase tracking-wider">Confirm Password</label>
						<input
							type="password"
							required
							value={formData.confirmPassword}
							onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
							className="w-full rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-sans"
							placeholder="Re-enter your password"
						/>
					</div>

					<div>
						<label className="block text-xs font-mono text-zinc-400 mb-2 uppercase tracking-wider">Invite Code</label>
						<input
							type="text"
							required
							value={formData.inviteCode}
							onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
							className="w-full rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-sans"
							placeholder="Enter your invite code"
						/>
						<p className="text-xs text-zinc-500 font-mono mt-2">
							Contact 阿茅 (WeChat: njumwh) for an invite code
						</p>
					</div>

					{error && (
						<div className="text-sm text-rose-400 bg-rose-900/20 border border-rose-500/30 px-4 py-3 rounded-lg font-mono">
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={isLoading}
						className="w-full px-6 py-3 text-sm rounded-xl bg-white text-black font-bold hover:bg-zinc-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-sans"
					>
						{isLoading ? "Creating account..." : "Sign Up"}
					</button>
				</form>

				<div className="mt-8 text-center">
					<p className="text-sm text-zinc-500 font-mono">
						Already have an account?{" "}
						<Link href="/login" className="text-white hover:text-indigo-400 transition-colors underline underline-offset-4">
							Sign in
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
