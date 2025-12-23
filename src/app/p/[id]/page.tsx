"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { EditMeta } from "./EditMeta";
import { SummaryDisplay } from "@/components/SummaryDisplay";

type Detail = {
	id: string;
	title: string;
    showTitle?: string | null;
    showAuthor?: string | null;
	description?: string | null;
	guests?: string | null;
	publishedAt?: string | null;
	summary?: string | null;
	translatedSummary?: string | null;
	transcript?: string | null;
	translatedTranscript?: string | null;
	audioUrl?: string | null;
};

export default function PodcastDetail({ params }: { params: Promise<{ id: string }> }) {
	const [id, setId] = useState<string>('');
	
	useEffect(() => {
		params.then(({ id }) => setId(id));
	}, [params]);
	const [detail, setDetail] = useState<Detail | null>(null);

	useEffect(() => {
		fetch(`/api/podcasts/${id}`)
			.then((r) => r.json())
			.then((d) => setDetail(d.item))
			.catch(() => setDetail(null));
	}, [id]);

	const [isEnglishOriginal, setIsEnglishOriginal] = useState(false); // 默认显示中文翻译

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">播客详情</h2>
				<Link href="/" className="text-sm text-blue-600 dark:text-blue-400">返回首页</Link>
			</div>
			{detail && (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<section className="md:col-span-2 space-y-3">
						<div className="flex items-center justify-between gap-2">
							<h3 className="text-base font-semibold">逐字稿</h3>
							{detail.translatedTranscript && (
								<button
									type="button"
									onClick={() => setIsEnglishOriginal((v) => !v)}
									className="flex items-center gap-2 rounded-full border border-gray-300/70 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
								>
									<span className="inline-flex items-center gap-1">
										<span className={`w-2 h-2 rounded-full ${isEnglishOriginal ? 'bg-blue-500' : 'bg-green-500'}`} />
										{isEnglishOriginal ? '显示译文' : '显示原文'}
									</span>
									<span className="text-gray-500">EN / 中</span>
								</button>
							)}
						</div>
						{(() => {
							const transcriptToShow =
								detail.translatedTranscript && !isEnglishOriginal
									? detail.translatedTranscript
									: detail.transcript;
							return (
								<>
									<div className="rounded-xl border border-black/10 dark:border-white/10 p-4 text-sm leading-6 bg-white/60 dark:bg-black/40 whitespace-pre-wrap">
										{transcriptToShow || "逐字稿内容暂未生成。"}
									</div>
									{transcriptToShow && <CopyButton text={transcriptToShow} label="一键复制逐字稿" />}
								</>
							);
						})()}
					</section>
					<aside className="space-y-3">
						<div className="flex items-center justify-between gap-2">
							<h3 className="text-base font-semibold">总结</h3>
							{detail.translatedSummary && (
								<button
									type="button"
									onClick={() => setIsEnglishOriginal((v) => !v)}
									className="flex items-center gap-2 rounded-full border border-gray-300/70 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
								>
									<span className="inline-flex items-center gap-1">
										<span className={`w-2 h-2 rounded-full ${isEnglishOriginal ? 'bg-blue-500' : 'bg-green-500'}`} />
										{isEnglishOriginal ? '显示译文' : '显示原文'}
									</span>
									<span className="text-gray-500">EN / 中</span>
								</button>
							)}
						</div>
						{(() => {
							const summaryToShow =
								detail.translatedSummary && !isEnglishOriginal
									? detail.translatedSummary
									: detail.summary;
							return (
								<>
									<SummaryDisplay 
										summary={summaryToShow}
										report={summaryToShow}
										className="rounded-xl border border-black/10 dark:border-white/10 p-4 text-sm leading-6 bg-white/60 dark:bg-black/40"
										showMarkdown={false}
										fallbackText="总结内容暂未生成。"
									/>
									{summaryToShow && <CopyButton text={summaryToShow} label="一键复制总结" />}
								</>
							);
						})()}
						<div className="pt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <EditMeta id={id} detail={detail} onUpdated={(d)=>setDetail(d)} />
							<p>嘉宾：{detail.guests || "—"}</p>
							<p>描述：{detail.description || "—"}</p>
							{detail.audioUrl && (
								<a href={detail.audioUrl} className="text-blue-600 dark:text-blue-400" target="_blank" rel="noreferrer">下载音频</a>
							)}
							<div className="pt-4">
								<img src="/qrcode-placeholder.png" alt="打赏二维码" className="w-40 h-40 rounded-lg border border-black/10 dark:border-white/10" />
							</div>
						</div>
					</aside>
				</div>
			)}
		</div>
	);
}
