import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const target = url.searchParams.get("url");
	if (!target) return new Response("Bad Request", { status: 400 });

	// TODO: add domain allowlist & rate limit
	const range = req.headers.get("range") ?? undefined;
	const headers: Record<string, string> = {
		// Some sources require a referer to pass anti-hotlink
		referer: new URL(target).origin,
		origin: new URL(target).origin,
	};
	if (range) headers["range"] = range;

	const upstream = await fetch(target, { 
		headers,
		// 增加超时时间，支持大文件下载
		signal: AbortSignal.timeout(300000) // 5分钟超时
	});
	return new Response(upstream.body, {
		status: upstream.status,
		headers: upstream.headers,
	});
}
