import { NextRequest } from "next/server";
import { db } from "@/server/db";

function sevenDaysAgo(): Date {
	const d = new Date();
	d.setDate(d.getDate() - 7);
	return d;
}

export async function GET(_req: NextRequest) {
	const since = sevenDaysAgo();
	// Aggregate access counts in last 7 days
	const rows = await db.$queryRawUnsafe<any[]>(
		`SELECT p.id, p.title, p.summary, p."updatedAt", COUNT(a.id) AS cnt
		 FROM "Podcast" p
		 LEFT JOIN "AccessLog" a ON a."podcastId" = p.id AND a."createdAt" >= $1
		 GROUP BY p.id
		 ORDER BY cnt DESC NULLS LAST, p."updatedAt" DESC
		 LIMIT 30;`,
		since
	);
	return Response.json({ items: rows });
}
