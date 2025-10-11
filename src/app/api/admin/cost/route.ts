import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { estimateCostSummary } from "@/server/cost";

export async function GET(req: NextRequest) {
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
	
	const data = await estimateCostSummary();
	return Response.json(data);
}
