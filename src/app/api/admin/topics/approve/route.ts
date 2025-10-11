import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { z } from "zod";
import { requireUser } from "@/server/auth";

const schema = z.object({
	actions: z.array(
		z.object({
			id: z.string(),
			type: z.enum(["approve", "delete", "merge"]),
			mergeToId: z.string().optional(),
		})
	),
});

export async function POST(req: NextRequest) {
	const json = await req.json().catch(() => null);
	const parsed = schema.safeParse(json);
	if (!parsed.success) return new Response("Bad Request", { status: 400 });
	const { actions } = parsed.data;
	
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

	await db.$transaction(
		actions.map((a) => {
			if (a.type === "approve") return db.topic.update({ where: { id: a.id }, data: { approved: true } });
			if (a.type === "delete") return db.topic.delete({ where: { id: a.id } });
			if (a.type === "merge") {
				if (!a.mergeToId) throw new Error("mergeToId required");
				return db.$transaction([
					db.podcast.updateMany({ where: { topicId: a.id }, data: { topicId: a.mergeToId } }),
					db.topic.delete({ where: { id: a.id } }),
				]);
			}
			throw new Error("invalid action");
		})
	);
	return Response.json({ ok: true });
}
