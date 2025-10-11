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

	const upstream = await fetch(target, { headers });
	return new Response(upstream.body, {
		status: upstream.status,
		headers: upstream.headers,
	});
}
