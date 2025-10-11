import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";

export async function GET(_req: NextRequest) {
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
	
	const items = await db.taskLog.findMany({
		orderBy: { createdAt: "desc" },
		take: 50,
	});
	return Response.json({ items });
}
