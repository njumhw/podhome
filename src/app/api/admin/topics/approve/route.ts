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

	await db.$transaction(async (tx) => {
		for (const a of actions) {
			if (a.type === "approve") {
				await tx.topic.update({ where: { id: a.id }, data: { approved: true } });
			} else if (a.type === "delete") {
				await tx.topic.delete({ where: { id: a.id } });
			} else if (a.type === "merge") {
				if (!a.mergeToId) throw new Error("mergeToId required");
				await tx.podcast.updateMany({ where: { topicId: a.id }, data: { topicId: a.mergeToId } });
				await tx.topic.delete({ where: { id: a.id } });
			} else {
				throw new Error("invalid action");
			}
		}
	});
	return Response.json({ ok: true });
}
