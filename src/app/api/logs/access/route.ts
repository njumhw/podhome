import { NextRequest } from "next/server";
import { db } from "@/server/db";

export async function GET(_req: NextRequest) {
	const items = await db.accessLog.findMany({
		orderBy: { createdAt: "desc" },
		take: 50,
	});
	return Response.json({ items });
}
