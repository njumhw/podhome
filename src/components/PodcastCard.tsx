import Link from "next/link";
import { getStyleFromTitle } from "@/utils/podcast-styles";

type PodcastItem = {
	id: string;
	title: string;
	summary?: string | null;
	topic?: string | null;
	updatedAt?: string;
	likeCount?: number;
	author?: string | null;
	publishedAt?: string | null;
};

type PodcastCardProps = {
	item: PodcastItem;
	rank?: number; // 排名数字（可选）
};

// 根据主题标签生成颜色（RGB值）
function getColorFromTopic(topic: string | null | undefined): string {
	if (!topic) return 'rgb(129, 140, 248)'; // indigo-400
	
	// 基于主题名称生成一致的颜色（使用RGB值以便内联样式使用）
	const topicColors: Record<string, string> = {
		'科技': 'rgb(129, 140, 248)',      // indigo-400
		'管理': 'rgb(156, 163, 175)',      // gray-400
		'投资': 'rgb(52, 211, 153)',       // emerald-400
		'商业': 'rgb(251, 191, 36)',       // amber-400
		'教育': 'rgb(96, 165, 250)',       // blue-400
		'文化': 'rgb(244, 114, 182)',      // pink-400
		'健康': 'rgb(248, 113, 113)',      // red-400
		'生命': 'rgb(34, 211, 238)',       // cyan-400
		'生活': 'rgb(132, 204, 22)',       // lime-400
	};
	
	return topicColors[topic] || 'rgb(129, 140, 248)'; // 默认 indigo-400
}

export function PodcastCard({ item, rank }: PodcastCardProps) {
	const style = getStyleFromTitle(item.title);
	const waveformColor = getColorFromTopic(item.topic);
	
	// 提取集数编号（如果有）
	const episodeMatch = item.title.match(/#(\d+)/);
	const episodeNumber = episodeMatch ? episodeMatch[1] : null;
	
	// 移除标题开头的数字（如 "#326." 或 "120." 等）
	let cleanTitle = item.title.replace(/^(#?\d+\.?\s*)/, '').trim();
	
	// 移除标题末尾的作者信息（如 " - 跨国串门儿计划" 或 " | 作者名" 等）
	cleanTitle = cleanTitle.replace(/\s*[-|]\s*[^-|]+$/, '').trim();
	
	// 格式化日期
	const dateStr = item.publishedAt 
		? new Date(item.publishedAt).toLocaleDateString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		})
		: item.updatedAt
		? new Date(item.updatedAt).toLocaleDateString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		})
		: '未知时间';

	// 判断是否为前三个（火热状态）
	const isHotRank = rank !== undefined && rank <= 3;
	
	// 根据排名获取渐变边框颜色
	const getHotGradient = (rank: number) => {
		if (rank === 1) return 'linear-gradient(135deg, #f97316, #ef4444, #dc2626)';
		if (rank === 2) return 'linear-gradient(135deg, #fb923c, #f97316, #ef4444)';
		return 'linear-gradient(135deg, #fbbf24, #fb923c, #f97316)';
	};
	
	const CardContent = () => (
		<>
			{/* 排名数字背景 - 右下角 */}
			{rank !== undefined && (
				<div 
					className="absolute bottom-0 right-0 pointer-events-none ranking-number"
					style={{
						fontSize: '140px',
						fontWeight: 'bold',
						fontStyle: 'italic',
						color: 'rgba(255, 255, 255, 0.04)',
						lineHeight: 1,
						fontFamily: 'monospace',
						userSelect: 'none',
						transform: 'translate(15%, 15%) skew(-5deg)',
						letterSpacing: '-0.05em',
					}}
				>
					{String(rank).padStart(2, '0')}
				</div>
			)}
			
			{/* Meta Header */}
			<div className="relative z-10 flex justify-between items-center font-mono text-xs text-zinc-200 dark:text-zinc-200 [data-theme='light']:text-slate-900 mb-4">
				<div className="flex items-center gap-2">
					{item.topic && (
						<span className="px-2 py-0.5 rounded border border-white/20 dark:border-white/20 [data-theme='light']:border-slate-400 bg-white/20 dark:bg-white/20 [data-theme='light']:bg-white text-white dark:text-white [data-theme='light']:text-black font-semibold">
							#{item.topic}
						</span>
					)}
				</div>
				<span className="text-white/70 dark:text-white/70 [data-theme='light']:text-slate-700">{dateStr}</span>
			</div>
			
			{/* Main Title */}
			<h3 className={`
				relative z-10 mt-3 text-base font-bold text-white dark:text-white [data-theme='light']:text-foreground
				group-hover:text-zinc-100 dark:group-hover:text-zinc-100 [data-theme='light']:group-hover:text-slate-800
				line-clamp-3
				transition-colors duration-300
				leading-snug
				flex-1
			`}>
				{cleanTitle}
			</h3>
			
			{/* Footer with Pulse Animation */}
			<div className="relative z-10 mt-4 flex justify-between items-end flex-shrink-0">
				{item.author && (
					<span className="text-sm dark:text-white [data-theme='light']:text-slate-950 font-mono font-medium author-name">
						{item.author}
					</span>
				)}
				
				{/* Fake Audio Visualizer - 根据标签显示不同颜色 */}
				<div className="flex gap-1 h-4 items-end">
					<div 
						className="w-1 rounded-full"
						style={{
							backgroundColor: waveformColor,
							height: '60%',
							animation: 'pulse 1.5s ease-in-out infinite',
						}}
					></div>
					<div 
						className="w-1 rounded-full"
						style={{
							backgroundColor: waveformColor,
							height: '80%',
							animation: 'pulse 1.5s ease-in-out infinite 0.2s',
						}}
					></div>
					<div 
						className="w-1 rounded-full"
						style={{
							backgroundColor: waveformColor,
							height: '100%',
							animation: 'pulse 1.5s ease-in-out infinite 0.4s',
						}}
					></div>
					<div 
						className="w-1 rounded-full"
						style={{
							backgroundColor: waveformColor,
							height: '70%',
							animation: 'pulse 1.5s ease-in-out infinite 0.6s',
						}}
					></div>
				</div>
			</div>
		</>
	);
	
	return (
		<Link 
			href={`/podcast/${item.id}`} 
			className="block group h-full"
		>
			{isHotRank ? (
				// 前三个使用渐变边框包装，但卡片背景保持不变
				<div 
					className="h-full rounded-lg p-[2px] transition-all duration-300 hover:-translate-y-1"
					style={{
						background: getHotGradient(rank!),
					}}
					onMouseEnter={(e) => {
						const glowColor = rank === 1 
							? 'rgba(239, 68, 68, 0.4)'
							: rank === 2
							? 'rgba(249, 115, 22, 0.4)'
							: 'rgba(251, 191, 36, 0.4)';
						e.currentTarget.style.boxShadow = `0 10px 40px ${glowColor}`;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,0,0,0)';
					}}
				>
					<div
						className={`
							relative border border-white/5 dark:border-white/5 [data-theme='light']:border-card-border
							bg-[#0f0f0f] dark:bg-[#0f0f0f] [data-theme='light']:bg-card-surface
							p-6 transition-all duration-300
							hover:-translate-y-1
							hover:border-white/10 dark:hover:border-white/10 [data-theme='light']:hover:border-slate-300
							hover:bg-[#151515] dark:hover:bg-[#151515] [data-theme='light']:hover:bg-slate-50
							${style.border}
							group-hover:shadow-2xl
							h-full
							flex flex-col
							overflow-hidden
							card-bg
						`}
						style={{
							boxShadow: '0 0 0 0 rgba(0,0,0,0)',
							minHeight: '240px',
							backdropFilter: 'blur(8px)',
						}}
						onMouseEnter={(e) => {
							const glowColor = rank === 1 
								? 'rgba(239, 68, 68, 0.35)'
								: rank === 2
								? 'rgba(249, 115, 22, 0.35)'
								: 'rgba(251, 191, 36, 0.35)';
							e.currentTarget.style.boxShadow = `0 10px 40px ${glowColor}`;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,0,0,0)';
						}}
					>
						<CardContent />
					</div>
				</div>
			) : (
				// 其他排名使用普通边框
				<div 
					className={`
						relative border border-white/5 dark:border-white/5 [data-theme='light']:border-card-border
						bg-zinc-900/40 dark:bg-zinc-900/40 [data-theme='light']:bg-card-surface backdrop-blur-sm
						p-6 transition-all duration-300
						hover:-translate-y-1
						hover:border-white/10 dark:hover:border-white/10 [data-theme='light']:hover:border-slate-300
						hover:bg-zinc-900/60 dark:hover:bg-zinc-900/60 [data-theme='light']:hover:bg-slate-50
						${style.border}
						group-hover:shadow-2xl
						h-full
						flex flex-col
						overflow-hidden
						card-bg
					`}
					style={{
						boxShadow: '0 0 0 0 rgba(0,0,0,0)',
						minHeight: '240px',
					}}
					onMouseEnter={(e) => {
						const color = style.glow.replace('shadow-', '').replace('/30', '');
						e.currentTarget.style.boxShadow = `0 10px 40px ${color}`;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0,0,0,0)';
					}}
				>
					<CardContent />
				</div>
			)}
		</Link>
	);
}

export default PodcastCard;
