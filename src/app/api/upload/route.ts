import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth";
import { startOfTodayUTC, endOfTodayUTC } from "@/utils/date";
import { jsonError } from "@/utils/http";
import { checkUserUploadLimit } from "@/server/user-limits";
import { UserRole } from "@prisma/client";

const bodySchema = z.object({
	url: z.string().url(),
	topic: z.string().optional(),
	title: z.string().min(1).optional(),
	episodeNumber: z.string().optional(),
	language: z.string().default("zh"),
});

export async function POST(req: NextRequest) {
	const user = await requireUser().catch(() => null);
	if (!user) return jsonError("Unauthorized", 401);

	// 检查用户上传限制
	const limitCheck = await checkUserUploadLimit(user.id, user.role as UserRole);
	if (!limitCheck.allowed) {
		return jsonError(limitCheck.reason || "Upload limit exceeded", 429);
	}

	const json = await req.json().catch(() => null);
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) return jsonError("Bad Request", 400);

	const { url, topic, title, episodeNumber, language } = parsed.data;

	let topicId: string | undefined;
	if (topic) {
		const t = await db.topic.upsert({
			where: { name: topic },
			update: {},
			create: { name: topic, approved: false },
		});
		topicId = t.id;
	}

	const p = await db.podcast.create({
		data: {
			title: title ?? "未命名播客",
			sourceUrl: url,
			status: "PROCESSING",
			episodeNumber,
			language,
			processingStartedAt: new Date(),
			topicId,
			createdById: user.id,
		},
		select: { id: true },
	});

	// 更新用户上传计数
	await db.user.update({
		where: { id: user.id },
		data: { uploadCount: { increment: 1 } },
	});

	return Response.json({ id: p.id });
}
