import { NextRequest } from "next/server";
import { db } from "@/server/db";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const q = searchParams.get("q")?.trim();
	if (!q) return Response.json({ items: [] });

	const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

	const items = await db.$queryRawUnsafe<any[]>(
		`SELECT p.id, p.title, p.summary, p."updatedAt", t.name as topic
		 FROM "Podcast" p
		 LEFT JOIN "Topic" t ON t.id = p."topicId"
		 WHERE p.title ILIKE $1 OR p.guests ILIKE $1 OR t.name ILIKE $1 OR p.transcript ILIKE $1
		 ORDER BY p."updatedAt" DESC
		 LIMIT 30;`,
		like
	);
	return Response.json({ items });
}
