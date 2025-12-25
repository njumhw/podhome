import { NextRequest, NextResponse } from "next/server";
import { getPodcastSummary } from "@/server/services/podcastSummary";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const force = searchParams.get('force') === 'true';
		
		console.log(`[api/public/summary] 开始获取摘要数据... (force=${force})`);
		// 默认不使用force，直接读取缓存（后端会在播客处理完成后自动更新）
		// 只有在明确要求时才强制刷新
		const summary = await getPodcastSummary(force);
		const totalDurationMinutes = Math.round(
			(summary.totalDurationSeconds ?? 0) / 60
		);

		const payload = {
			totalPodcasts: summary.totalPodcasts,
			totalDurationSeconds: summary.totalDurationSeconds,
			totalDurationMinutes,
			refreshedAt: summary.refreshedAt,
		};

		console.log(`[api/public/summary] 成功获取摘要: ${payload.totalPodcasts} 个播客, ${totalDurationMinutes} 分钟`);

		const res = NextResponse.json(payload);
		res.headers.set(
			"Cache-Control",
			"public, max-age=300, s-maxage=300, stale-while-revalidate=60"
		);
		return res;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorCode = (error as any)?.code;
		console.error("[api/public/summary] 获取摘要失败:", {
			message: errorMessage,
			code: errorCode,
			stack: error instanceof Error ? error.stack : undefined
		});
		
		// 检查是否是数据库连接问题
		if (errorMessage.includes('Can\'t reach database server') || 
		    errorMessage.includes('connection pool') ||
		    errorMessage.includes('P1001') ||
		    errorMessage.includes('P1017') ||
		    errorCode === 'P1001' ||
		    errorCode === 'P1017') {
			console.error("[api/public/summary] 数据库连接问题，返回默认值");
			// 返回默认值而不是500错误，避免前端崩溃
			return NextResponse.json({
				totalPodcasts: 0,
				totalDurationSeconds: 0,
				totalDurationMinutes: 0,
				refreshedAt: new Date().toISOString(),
			});
		}
		
		// 其他错误也返回默认值，而不是500
		console.error("[api/public/summary] 返回默认值以避免前端崩溃");
		return NextResponse.json({
			totalPodcasts: 0,
			totalDurationSeconds: 0,
			totalDurationMinutes: 0,
			refreshedAt: new Date().toISOString(),
		});
	}
}

