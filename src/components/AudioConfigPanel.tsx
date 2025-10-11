"use client";

import { useState, useEffect } from "react";

export function AudioConfigPanel() {
	const [config, setConfig] = useState({
		segmentDuration: 170,
		enableAutoSegment: true,
		maxConcurrentSegments: 3,
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	async function loadConfig() {
		setError(null);
		try {
			const res = await fetch("/api/admin/audio-config");
			if (!res.ok) throw new Error("加载配置失败");
			const data = await res.json();
			setConfig(data.config);
		} catch (e: any) {
			setError(e.message);
		}
	}

	async function saveConfig() {
		setLoading(true);
		setError(null);
		setSuccess(false);
		
		try {
			const res = await fetch("/api/admin/audio-config", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(config),
			});
			
			if (!res.ok) throw new Error("保存配置失败");
			
			setSuccess(true);
			setTimeout(() => setSuccess(false), 3000);
		} catch (e: any) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { loadConfig(); }, []);

	return (
		<div className="space-y-6">
			<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
				<h3 className="text-lg font-semibold mb-4">音频处理配置</h3>
				
				{error && (
					<div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
						<div className="text-red-800 dark:text-red-200 text-sm">{error}</div>
					</div>
				)}
				
				{success && (
					<div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
						<div className="text-green-800 dark:text-green-200 text-sm">配置保存成功！</div>
					</div>
				)}

				<div className="space-y-4">
					{/* 切割时长配置 */}
					<div>
						<label className="block text-sm font-medium mb-2">
							音频切割时长（秒）
						</label>
						<div className="flex items-center space-x-4">
							<input
								type="number"
								min="10"
								max="180"
								value={config.segmentDuration}
								onChange={(e) => setConfig({...config, segmentDuration: parseInt(e.target.value) || 170})}
								className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
							/>
							<span className="text-sm text-gray-500">
								{Math.floor(config.segmentDuration / 60)}分{config.segmentDuration % 60}秒
							</span>
							<span className="text-xs text-gray-400">
								（阿里云ASR限制：≤180秒，建议≤170秒）
							</span>
						</div>
					</div>

					{/* 自动切割开关 */}
					<div>
						<label className="flex items-center space-x-3">
							<input
								type="checkbox"
								checked={config.enableAutoSegment}
								onChange={(e) => setConfig({...config, enableAutoSegment: e.target.checked})}
								className="rounded border-gray-300 dark:border-gray-600"
							/>
							<span className="text-sm font-medium">启用自动音频切割</span>
						</label>
						<p className="text-xs text-gray-500 mt-1">
							上传播客时自动进行音频切割处理
						</p>
					</div>

					{/* 并发处理数量 */}
					<div>
						<label className="block text-sm font-medium mb-2">
							最大并发处理数
						</label>
						<div className="flex items-center space-x-4">
							<input
								type="number"
								min="1"
								max="20"
								value={config.maxConcurrentSegments}
								onChange={(e) => setConfig({...config, maxConcurrentSegments: parseInt(e.target.value) || 3})}
								className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
							/>
							<div className="text-sm text-gray-500">
								<span>同时处理的音频片段数量</span>
								<div className="text-xs text-gray-400 mt-1">
									建议值：1-5（轻量服务器），5-10（中等配置），10-20（高性能服务器）
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-6 flex space-x-3">
					<button
						onClick={saveConfig}
						disabled={loading}
						className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
					>
						{loading ? "保存中..." : "保存配置"}
					</button>
					<button
						onClick={loadConfig}
						className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
					>
						重置
					</button>
				</div>
			</div>

			{/* 配置说明 */}
			<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
				<h4 className="font-medium mb-2">配置说明</h4>
				<ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
					<li>• <strong>切割时长</strong>：每个音频片段的时长，建议≤170秒以确保ASR兼容性</li>
					<li>• <strong>自动切割</strong>：用户上传播客时是否自动进行音频切割</li>
					<li>• <strong>并发数量</strong>：同时处理的音频片段数量，影响处理速度和服务器负载</li>
				</ul>
			</div>
		</div>
	);
}
