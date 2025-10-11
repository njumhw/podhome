import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdminSecret } from "@/server/auth";
import { jsonError } from "@/utils/http";

// 获取系统配置
export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const adminSecret = searchParams.get("adminSecret");
	if (!adminSecret || !requireAdminSecret(adminSecret)) {
		return jsonError("Forbidden", 403);
	}

	const configs = await db.systemConfig.findMany({
		select: { key: true, value: true, updatedAt: true },
	});

	// 转换为键值对格式
	const configMap: Record<string, { value: string; updatedAt: Date }> = {};
	for (const config of configs) {
		configMap[config.key] = {
			value: config.value,
			updatedAt: config.updatedAt,
		};
	}

	return Response.json({ configs: configMap });
}

// 更新系统配置
const updateSchema = z.object({
	adminSecret: z.string(),
	key: z.string(),
	value: z.string(),
});

export async function PUT(req: NextRequest) {
	const json = await req.json().catch(() => null);
	const parsed = updateSchema.safeParse(json);
	if (!parsed.success) return jsonError("Bad Request", 400);

	const { adminSecret, key, value } = parsed.data;
	if (!requireAdminSecret(adminSecret)) {
		return jsonError("Forbidden", 403);
	}

	// 使用 upsert 创建或更新配置
	await db.systemConfig.upsert({
		where: { key },
		update: { value },
		create: { key, value },
	});

	return Response.json({ ok: true });
}

// 批量更新配置
const batchUpdateSchema = z.object({
	adminSecret: z.string(),
	configs: z.record(z.string(), z.string()),
});

export async function PATCH(req: NextRequest) {
	const json = await req.json().catch(() => null);
	const parsed = batchUpdateSchema.safeParse(json);
	if (!parsed.success) return jsonError("Bad Request", 400);

	const { adminSecret, configs } = parsed.data;
	if (!requireAdminSecret(adminSecret)) {
		return jsonError("Forbidden", 403);
	}

	// 批量更新配置
	await db.$transaction(
		Object.entries(configs).map(([key, value]) =>
			db.systemConfig.upsert({
				where: { key },
				update: { value },
				create: { key, value },
			})
		)
	);

	return Response.json({ ok: true });
}
