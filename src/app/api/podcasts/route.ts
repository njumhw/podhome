import { NextRequest } from "next/server";
import { db } from "@/server/db";

export async function GET(_req: NextRequest) {
	const items = await db.podcast.findMany({
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			title: true,
			summary: true,
			status: true,
			createdAt: true,
			updatedAt: true,
			topic: { select: { name: true } },
		},
		take: 30,
	});
	return Response.json({ items });
}
