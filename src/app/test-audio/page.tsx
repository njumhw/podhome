"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProcessResult {
	success: boolean;
	step: string;
	progress: number;
	data: {
		podcastTitle: string;
		title: string;
		author: string;
		publishedAt: string;
		audioUrl: string;
		transcript: string;
		script: string;
		summary: string | null;
		duration: number;
		cached: boolean;
	};
	stats: {
		totalTime: number;
		asrTime?: number;
		estimatedTokens?: number;
		fromCache: boolean;
	};
}

export default function TestAudioPage() {
	const [url, setUrl] = useState("https://www.xiaoyuzhoufm.com/episode/68ccfa75a56ca3e0c438706d");
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<ProcessResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);
	const [currentStep, setCurrentStep] = useState("");
	const tips = useMemo(() => [
		"阿茂拿起了他新买的 Sony 耳机…",
		"正在为你调整降噪档位…",
		"别着急，精彩马上到…",
		"正在给 Qwen 续杯咖啡…",
		"FFmpeg 正在飞速切片中…",
		"ASR 正在和语速赛跑…",
		"讲稿在打磨用词，马上呈上…",
		"报告在整理结构，不漏重点…",
		"阿茂又去送了一单闪购订单…",
		"服务器在原地小跑，稳住稳住…",
		"缓存翻找中，能省就省…",
		"OSS 正在上传小分片…",
		"网络晃了一下，立即重试…",
		"模型正在思考更顺滑的转场…",
		"去重小助手在扫除重复句子…",
		"正在校对人名与角色标签…",
		"段落排版对齐中，强迫症在线…",
		"阿茂请你喝一杯水，休息十秒…",
		"音量表在跳舞，别被吓到…",
		"马上就好，感谢你的耐心…",
	], []);
	const [tipIndex, setTipIndex] = useState(0);
	useEffect(() => {
		if (!loading) return;
		const t = setInterval(() => setTipIndex(i => {
			let next = i;
			while (next === i) {
				next = Math.floor(Math.random() * tips.length);
			}
			return next;
		}), 7000);
		return () => clearInterval(t);
	}, [loading, tips.length]);

	// 可编辑的播客信息（解析后立即展示给用户）
	const [title, setTitle] = useState("");
	const [author, setAuthor] = useState("");
	const [publishedAt, setPublishedAt] = useState("");
	const [audioUrl, setAudioUrl] = useState("");
	const [durationSec, setDurationSec] = useState<number | null>(null);

	// 简单 ETA 估算：基于音频时长和当前阶段，粗略给出剩余分钟
	const etaText = useMemo(() => {
		if (!loading) return "";
		const d = durationSec ?? 0;
		// 更保守：总耗时 ≈ 实时长度的 0.35x + 5min 缓冲
		const base = d > 0 ? (d / 60) * 0.35 : 15; // 无时长时给 15min 预估
		const totalMinutes = Math.max(5, Math.ceil(base + 5));
		// 冗余系数 1.4，避免过早归零
		const left = Math.max(2, Math.ceil(totalMinutes * (1 - Math.min(0.98, progress / 100)) * 1.4));
		return `预计还需约 ${left} 分钟`;
	}, [durationSec, loading, progress]);

	const handleProcess = async () => {
		setLoading(true);
		setError(null);
		setProgress(0);
		setResult(null);
		setCurrentStep("开始处理...");

		// 先解析：拿到标题/作者/发布时间/直链，第一时间给到用户
		try {
			const r = await fetch("/api/resolve-audio", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url })
			});
			const j = await r.json();
			if (j?.success) {
				const audio = j.url || j.audioUrl || "";
				setTitle(j.title || j.audioInfo?.title || "");
				setAuthor(j.author || j.audioInfo?.author || "");
				setPublishedAt(j.publishedAt || j.audioInfo?.publishedAt || "");
				setAudioUrl(audio);
				// 不阻塞后续流程：立即展示"已获取元信息，继续处理中"
				setCurrentStep("已获取标题与音频链接，正在转写与生成...");
				setProgress(10);
			} else {
				setCurrentStep("解析失败，仍尝试一键处理...");
			}
		} catch {
			// 解析失败也不拦截后续一键
		}

		// 进度推进：更保守，最高推进到 88%，等待最终结果再置 100
		const progressInterval = setInterval(() => {
			setProgress(prev => {
				if (prev >= 88) return prev;
				return Math.min(88, prev + 1 + Math.random() * 2);
			});
		}, 1200);

		try {
			// 使用异步处理API
			const res = await fetch("/api/process-audio-async", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url }),
			});
			
			const data = await res.json();
			
			if (data.success && data.taskId) {
				setCurrentStep("任务已提交，正在后台处理中...");
				setProgress(20);
				
				// 开始轮询任务状态
				pollTaskStatus(data.taskId);
			} else {
				clearInterval(progressInterval);
				setError(data.error || "处理失败");
				setCurrentStep("处理失败");
				setLoading(false);
			}
		} catch (err: any) {
			clearInterval(progressInterval);
			setError(err.message);
			setCurrentStep("处理失败");
			setLoading(false);
		}
	};

	// 轮询任务状态
	const pollTaskStatus = async (taskId: string) => {
		const pollInterval = setInterval(async () => {
			try {
				const res = await fetch(`/api/task-status?taskId=${taskId}`);
				if (!res.ok) return;
				
				const taskStatus = await res.json();
				
				if (taskStatus.status === 'READY') {
					clearInterval(pollInterval);
					setProgress(100);
					setCurrentStep("处理完成！");
					
					// 构造结果对象
					const result: ProcessResult = {
						success: true,
						step: "completed",
						progress: 100,
						data: {
							podcastTitle: taskStatus.result?.title || title,
							title: taskStatus.result?.title || title,
							author: taskStatus.result?.author || author,
							publishedAt: taskStatus.result?.publishedAt || publishedAt,
							audioUrl: taskStatus.result?.audioUrl || audioUrl,
							transcript: taskStatus.result?.transcript || "",
							script: taskStatus.result?.script || "",
							summary: taskStatus.result?.summary || null,
							duration: taskStatus.result?.duration || 0,
							cached: false
						},
						stats: {
							totalTime: taskStatus.result?.totalTime || 0,
							fromCache: false
						}
					};
					
					setResult(result);
					
					// 若后端已返回更准确的时长，记录以优化 ETA
					if (taskStatus.result?.duration) setDurationSec(taskStatus.result.duration);
					
					setLoading(false);
					
				} else if (taskStatus.status === 'FAILED') {
					clearInterval(pollInterval);
					setError(taskStatus.error || "处理失败");
					setCurrentStep("处理失败");
					setLoading(false);
				}
				
			} catch (error) {
				console.error('轮询任务状态失败:', error);
			}
		}, 3000); // 每3秒轮询一次
		
		// 设置超时，避免无限轮询
		setTimeout(() => {
			clearInterval(pollInterval);
			if (loading) {
				setError("处理超时");
				setCurrentStep("处理超时");
				setLoading(false);
			}
		}, 30 * 60 * 1000); // 30分钟超时
	};

	return (
		<div className="max-w-4xl mx-auto p-6">
			<h1 className="text-2xl font-bold mb-6">🎙️ 播客智能处理</h1>
			
			<div className="space-y-6">
				{/* 输入区域 */}
				<div className="bg-white p-6 rounded-lg border border-gray-300 shadow-sm">
					<label className="block text-sm font-medium mb-3">播客链接</label>
					<input
						type="url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						className="w-full p-4 border border-gray-300 rounded-lg text-lg text-gray-900 placeholder-gray-500 bg-white"
						placeholder="粘贴小宇宙播客链接..."
						disabled={loading}
					/>
				</div>

				{/* 处理按钮 */}
				<div className="text-center">
					<button 
						onClick={handleProcess} 
						disabled={loading || !url.trim()}
						className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-lg shadow-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
					>
						{loading ? "阿茂在听啦，先看看其他的播客吧" : "🚀 交给阿茂吧"}
					</button>
				</div>

				{/* 进度显示 */}
				{loading && (
					<div className="bg-white p-6 rounded-lg border border-gray-300 shadow-sm">
						<div className="flex items-center justify-between mb-3">
							<span className="text-sm font-medium text-gray-900">处理进度</span>
							<span className="text-sm text-gray-800">{Math.round(progress)}% {etaText && <span className="ml-2 text-gray-600">({etaText})</span>}</span>
						</div>
						<div className="w-full bg-gray-300 rounded-full h-3 mb-3">
							<div 
								className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500"
								style={{ width: `${progress}%` }}
							></div>
						</div>
					<p className="text-sm text-gray-900 text-center">{currentStep}</p>
					<p className="text-xs text-gray-600 text-center mt-2">{tips[tipIndex]}</p>
					</div>
				)}

				{/* 解析完成后立刻给到用户的基础信息与直链（不用等总结果） */}
				{loading && (title || author || publishedAt || audioUrl) && (
					<div className="bg-white p-6 rounded-lg border border-gray-300 shadow-sm">
						<h3 className="text-lg font-semibold mb-4">📻 播客信息（先行展示）</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
							<div className="space-y-3">
								<label className="block text-xs text-gray-500">单集标题</label>
								<input value={title} onChange={(e)=>setTitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-gray-900" />
								<label className="block text-xs text-gray-500 mt-3">作者</label>
								<input value={author} onChange={(e)=>setAuthor(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-gray-900" />
							</div>
							<div className="space-y-3">
								<label className="block text-xs text-gray-500">发布时间</label>
								<input value={publishedAt} onChange={(e)=>setPublishedAt(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-gray-900" />
								{durationSec && <p className="text-gray-600 text-xs mt-2">音频时长：{Math.round(durationSec / 60)} 分钟</p>}
							</div>
						</div>

						{audioUrl && (
							<div className="mt-4">
								<h4 className="text-sm font-medium mb-2">🔗 完整音频下载链接</h4>
								<div className="p-3 bg-gray-100 rounded border border-gray-300">
									<code className="text-sm break-all">{audioUrl}</code>
								</div>
								<p className="text-xs text-gray-700 mt-2">访谈全文与报告仍在生成中...</p>
							</div>
						)}
					</div>
				)}

				{/* 错误显示 */}
				{error && (
					<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
						<p className="text-red-600">❌ {error}</p>
					</div>
				)}

				{/* 结果显示 */}
				{result && (
					<div className="space-y-6">
					{/* 基本信息（只保留 标题/作者/发布时间，且可编辑） */}
					<div className="bg-white p-6 rounded-lg border border-gray-300 shadow-sm">
							<h3 className="text-lg font-semibold mb-4 flex items-center">
								📻 播客信息
							{result.data.cached && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">缓存</span>}
							</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
							<div className="space-y-3">
								<label className="block text-xs text-gray-500">单集标题</label>
								<input value={title || result.data.title || ""} onChange={(e)=>setTitle(e.target.value)} className="w-full p-2 border rounded" />
								<label className="block text-xs text-gray-500 mt-3">作者</label>
								<input value={author || result.data.author || ""} onChange={(e)=>setAuthor(e.target.value)} className="w-full p-2 border rounded" />
							</div>
							<div className="space-y-3">
								<label className="block text-xs text-gray-500">发布时间</label>
								<input value={publishedAt || result.data.publishedAt || ""} onChange={(e)=>setPublishedAt(e.target.value)} className="w-full p-2 border rounded" />
								{(result.data.duration || durationSec) && (
									<p className="text-gray-600 text-xs mt-2">音频时长：{Math.round((result.data.duration || durationSec || 0) / 60)} 分钟</p>
								)}
							</div>
						</div>
						</div>

						{/* 音频链接 */}
						<div className="bg-white p-6 rounded-lg border shadow-sm">
							<h3 className="text-lg font-semibold mb-4">🔗 完整音频下载链接</h3>
						<div className="p-3 bg-gray-100 rounded border border-gray-300">
								<code className="text-sm break-all">{result.data.audioUrl}</code>
							</div>
						</div>

						{/* 访谈全文 */}
					<div className="bg-white p-6 rounded-lg border border-gray-300 shadow-sm">
							<h3 className="text-lg font-semibold mb-4">📝 访谈全文</h3>
						<div className="p-4 bg-gray-100 rounded border border-gray-300 max-h-60 overflow-y-auto">
							<div className="prose prose-sm max-w-none text-gray-900 whitespace-pre-wrap">
									<ReactMarkdown 
										remarkPlugins={[remarkGfm]}
										components={{
											p: ({ children }) => <p className="mb-3 leading-6">{children}</p>,
											h1: ({ children }) => <h1 className="text-lg font-semibold mb-3 mt-4">{children}</h1>,
											h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-3">{children}</h2>,
											h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 mt-2">{children}</h3>,
											strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
											em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
											ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
											ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
											li: ({ children }) => <li className="text-sm">{children}</li>,
											blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-3">{children}</blockquote>,
											code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
											pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded overflow-x-auto mb-3">{children}</pre>,
										}}
									>
										{result.data.script}
									</ReactMarkdown>
								</div>
							</div>
						</div>

						{/* 整体报告 */}
					{result.data.summary && (
					<div className="bg-white p-6 rounded-lg border border-gray-300 shadow-sm">
								<h3 className="text-lg font-semibold mb-4">📊 整体报告</h3>
							<div className="p-4 bg-gray-100 rounded border border-gray-300 max-h-60 overflow-y-auto">
							<div className="prose prose-sm max-w-none text-gray-900">
										<ReactMarkdown 
											remarkPlugins={[remarkGfm]}
											components={{
												p: ({ children }) => <p className="mb-4 leading-7">{children}</p>,
												h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 text-gray-900">{children}</h1>,
												h2: ({ children }) => <h2 className="text-lg font-semibold mb-3 mt-5 text-gray-800">{children}</h2>,
												h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-4 text-gray-700">{children}</h3>,
												strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
												em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
												ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-2">{children}</ul>,
												ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-2">{children}</ol>,
												li: ({ children }) => <li className="text-sm leading-6">{children}</li>,
												blockquote: ({ children }) => <blockquote className="border-l-4 border-orange-300 pl-4 italic text-gray-600 mb-4 bg-orange-50 py-2">{children}</blockquote>,
												code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
												pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded overflow-x-auto mb-4">{children}</pre>,
											}}
										>
											{result.data.summary}
										</ReactMarkdown>
									</div>
								</div>
							</div>
					)}

					{/* 完成提示 */}
					<div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded">
						✅ 已全部完成：解析、切分、转写、讲稿与报告。
					</div>

					{/* 去掉处理统计 */}
					</div>
				)}
			</div>
		</div>
	);
}