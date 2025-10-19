import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { getSessionUser, requireUser } from "@/server/auth";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const item = await db.podcast.findUnique({
		where: { id },
		include: {
			chunks: { select: { id: true, startSec: true, endSec: true, text: true }, take: 200 },
			accessLogs: { select: { id: true, createdAt: true }, take: 5, orderBy: { createdAt: "desc" } },
		},
	});
	if (!item) return new Response("Not found", { status: 404 });

	// Fire-and-forget access log
	(async () => {
		try {
			const user = await getSessionUser();
			await db.accessLog.create({ data: { podcastId: id, userId: user?.id ?? null } });
		} catch {}
	})();

	return Response.json({ item });
}

const updateSchema = z.object({
	showAuthor: z.string().min(1).max(200).optional(),
	showTitle: z.string().min(1).max(200).optional(),
	publishedAt: z.string().optional(), // expect YYYY-MM-DD
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await requireUser().catch(() => null);
	if (!user) return new Response("Unauthorized", { status: 401 });

	const json = await req.json().catch(() => null);
	const parsed = updateSchema.safeParse(json);
	if (!parsed.success) return new Response("Bad Request", { status: 400 });

	const data: any = {};
	if (parsed.data.showAuthor !== undefined) data.showAuthor = parsed.data.showAuthor.trim();
	if (parsed.data.showTitle !== undefined) data.showTitle = parsed.data.showTitle.trim();
	if (parsed.data.publishedAt) {
		const d = new Date(parsed.data.publishedAt);
		if (!isNaN(d.getTime())) data.publishedAt = d;
	}

	const updated = await db.podcast.update({ where: { id }, data });
	return Response.json({ item: updated });
}
