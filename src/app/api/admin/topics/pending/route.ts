import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";

export async function POST(req: NextRequest) {
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
	
	const items = await db.topic.findMany({ 
		where: { approved: false }, 
		orderBy: { createdAt: "asc" } 
	});
	return Response.json({ items });
}
