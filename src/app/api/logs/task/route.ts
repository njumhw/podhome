import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";

function normalizeRange(value: number | null, min: number, max: number, fallback: number) {
	if (!value || Number.isNaN(value)) return fallback;
	return Math.min(Math.max(value, min), max);
}

export async function GET(req: NextRequest) {
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
	
	const { searchParams } = new URL(req.url);
	const limit = normalizeRange(Number(searchParams.get("limit")), 10, 2000, 1000);
	const skip = normalizeRange(Number(searchParams.get("skip")), 0, 100000, 0);

	const [total, tasks] = await Promise.all([
		db.taskQueue.count(),
		db.taskQueue.findMany({
			orderBy: { createdAt: "desc" },
			take: limit,
			skip,
		}),
	]);

	const urls = Array.from(new Set(tasks.map(task => {
		const data: any = task.data ?? {};
		return data.url as string | undefined;
	}).filter(Boolean))) as string[];

	const userIds = Array.from(new Set(tasks.map(task => {
		const data: any = task.data ?? {};
		return data.userId as string | undefined;
	}).filter(Boolean))) as string[];

	const [podcasts, users] = await Promise.all([
		urls.length > 0 ? db.podcast.findMany({
			where: { sourceUrl: { in: urls } },
			select: {
				id: true,
				title: true,
				sourceUrl: true,
				showAuthor: true,
				createdAt: true,
				_count: { select: { likes: true } },
				createdBy: {
					select: {
						id: true,
						username: true,
						email: true,
					},
				},
			},
		}) : [],
		userIds.length > 0 ? db.user.findMany({
			where: { id: { in: userIds } },
			select: { id: true, username: true, email: true },
		}) : [],
	]);

	const podcastMap = new Map(podcasts.map(p => [p.sourceUrl, p]));
	const userMap = new Map(users.map(u => [u.id, u]));

	const items = tasks.map(task => {
		const data: any = task.data ?? {};
		const url = data.url as string | undefined;
		const uploaderId = data.userId as string | undefined;
		const podcast = url ? podcastMap.get(url) : undefined;
		const uploader = uploaderId ? userMap.get(uploaderId) : undefined;
		const durationMs = task.startedAt && task.completedAt
			? task.completedAt.getTime() - task.startedAt.getTime()
			: null;

		return {
			id: task.id,
			status: task.status,
			url,
			error: task.error,
			metrics: task.metrics,
			createdAt: task.createdAt,
			startedAt: task.startedAt,
			completedAt: task.completedAt,
			durationMs,
			podcast: podcast ? {
				id: podcast.id,
				title: podcast.title,
				showAuthor: podcast.showAuthor,
				likes: podcast._count?.likes ?? 0,
				createdAt: podcast.createdAt,
			} : null,
			uploader: uploader ? {
				id: uploader.id,
				username: uploader.username,
				email: uploader.email,
			} : null,
		};
	});

	return Response.json({ items, total });
}
