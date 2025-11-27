import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { getSessionUser, requireUser } from "@/server/auth";
import { buildVisitorInfo, getVisitorUsage, recordVisitorAccess } from "@/server/visitorLimit";
import { z } from "zod";

// 获取客户端 IP 地址
function getClientIp(req: NextRequest): string {
	const forwarded = req.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	const realIp = req.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}
	// NextRequest 没有 ip 属性，使用 'unknown' 作为默认值
	return 'unknown';
}

// 获取 User-Agent
function getUserAgent(req: NextRequest): string {
	return req.headers.get('user-agent') || 'unknown';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const clientIp = getClientIp(req);
	const userAgent = getUserAgent(req);
	
	// 尝试获取用户（可能为 null，表示 Visitor）
	let user = null;
	try {
		user = await getSessionUser();
	} catch {
		// Visitor 访问，需要检查限制
	}

	// Visitor 访问限制检查
	if (!user) {
		const limitCheck = await getVisitorUsage(clientIp, userAgent);
		if (!limitCheck.allowed) {
			return Response.json(
				{
					error: 'VISITOR_LIMIT_EXCEEDED',
					message: '今日查看次数已用完，请注册登录后无限浏览',
					count: limitCheck.count,
					limit: limitCheck.limit,
				},
				{ status: 403 }
			);
		}
	}

	const item = await db.podcast.findUnique({
		where: { id },
		include: {
			chunks: { select: { id: true, startSec: true, endSec: true, text: true }, take: 200 },
			accessLogs: { select: { id: true, createdAt: true }, take: 5, orderBy: { createdAt: "desc" } },
		},
	});
	if (!item) return new Response("Not found", { status: 404 });

	// 记录访问日志（包含 IP 和 User-Agent），确保统计及时
	await recordVisitorAccess({
		podcastId: id,
		userId: user?.id ?? null,
		userIp: user ? null : clientIp,
		userAgent: user ? null : userAgent,
	});

	// 如果是 Visitor，返回剩余次数信息
	if (!user) {
		const limitCheck = await getVisitorUsage(clientIp, userAgent);
		return Response.json({
			item,
			visitorInfo: buildVisitorInfo(limitCheck),
		});
	}

	return Response.json({ item });
}

const updateSchema = z.object({
	showAuthor: z.string().min(1).max(200).optional(),
	showTitle: z.string().min(1).max(200).optional(),
	publishedAt: z.string().optional(), // expect YYYY-MM-DD
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await requireUser().catch(() => null);
	if (!user) return new Response("Unauthorized", { status: 401 });

	const json = await req.json().catch(() => null);
	const parsed = updateSchema.safeParse(json);
	if (!parsed.success) return new Response("Bad Request", { status: 400 });

	const data: any = {};
	if (parsed.data.showAuthor !== undefined) data.showAuthor = parsed.data.showAuthor.trim();
	if (parsed.data.showTitle !== undefined) data.showTitle = parsed.data.showTitle.trim();
	if (parsed.data.publishedAt) {
		const d = new Date(parsed.data.publishedAt);
		if (!isNaN(d.getTime())) data.publishedAt = d;
	}

	const updated = await db.podcast.update({ where: { id }, data });
	return Response.json({ item: updated });
}
