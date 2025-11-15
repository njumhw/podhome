import Link from "next/link";
import LikeButton from "./LikeButton";

type PodcastItem = {
	id: string;
	title: string;
	summary?: string | null;
	topic?: string | null;
	updatedAt?: string;
	likeCount?: number;
};

export function PodcastCard({ item }: { item: PodcastItem }) {
	return (
		<div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/40 p-4 hover:border-black/20 dark:hover:border-white/20 transition-colors">
			<Link href={`/podcast/${item.id}`} className="block">
				<div className="text-base font-semibold mb-1 truncate">{item.title}</div>
				{item.summary ? (
					<p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{item.summary}</p>
				) : (
					<p className="text-sm text-gray-500">暂无总结</p>
				)}
			</Link>
			<div className="mt-3 flex items-center justify-between">
				<div className="text-xs text-gray-500 flex gap-2">
					{item.topic && <span>#{item.topic}</span>}
					{item.updatedAt && <span>{new Date(item.updatedAt).toLocaleDateString()}</span>}
				</div>
				<LikeButton 
					podcastId={item.id} 
					initialLikeCount={item.likeCount || 0}
					className="text-xs"
				/>
			</div>
		</div>
	);
}
