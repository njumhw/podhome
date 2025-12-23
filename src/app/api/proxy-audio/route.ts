import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	const target = url.searchParams.get("url");
	if (!target) return new Response("Bad Request", { status: 400 });

	try {
		// TODO: add domain allowlist & rate limit
		const range = req.headers.get("range") ?? "bytes=0-";
		const targetUrl = new URL(target);
		const isApple = targetUrl.hostname.includes("apple.com");

		const headers: Record<string, string> = {
			// Some sources require a referer to pass anti-hotlink
			referer: targetUrl.origin,
			origin: targetUrl.origin,
			range,
		};

		// Apple Podcasts 等域名，补充 UA 与 Referer
		if (isApple) {
			headers["user-agent"] =
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
			headers["referer"] = "https://podcasts.apple.com/";
		}

		const upstream = await fetch(target, {
			headers,
			// 适配大文件：超时提升到 120 秒
			signal: AbortSignal.timeout(120_000),
		});

		if (!upstream.ok) {
			console.error(`proxy-audio: 上游请求失败: ${upstream.status} ${upstream.statusText}`);
			return new Response(`上游请求失败: ${upstream.status} ${upstream.statusText}`, {
				status: upstream.status,
			});
		}

		if (!upstream.body) {
			console.error("proxy-audio: 上游响应体为空");
			return new Response("上游响应体为空", { status: 500 });
		}

		return new Response(upstream.body, {
			status: upstream.status,
			headers: upstream.headers,
		});
	} catch (error: any) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`proxy-audio: 代理请求失败:`, errorMessage);

		if (errorMessage.includes("timeout") || errorMessage.includes("aborted")) {
			return new Response(`代理请求超时: ${errorMessage}`, { status: 504 });
		}

		if (errorMessage.includes("fetch")) {
			return new Response(`网络请求失败: ${errorMessage}`, { status: 502 });
		}

		return new Response(`代理请求失败: ${errorMessage}`, { status: 500 });
	}
}
