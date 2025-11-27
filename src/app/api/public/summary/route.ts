import { NextResponse } from "next/server";
import { getPodcastSummary } from "@/server/services/podcastSummary";

export async function GET() {
	try {
		const summary = await getPodcastSummary();
		const totalDurationMinutes = Math.round(
			(summary.totalDurationSeconds ?? 0) / 60
		);

		const payload = {
			totalPodcasts: summary.totalPodcasts,
			totalDurationSeconds: summary.totalDurationSeconds,
			totalDurationMinutes,
			refreshedAt: summary.refreshedAt,
		};

		const res = NextResponse.json(payload);
		res.headers.set(
			"Cache-Control",
			"public, max-age=300, s-maxage=300, stale-while-revalidate=60"
		);
		return res;
	} catch (error) {
		console.error("[api/public/summary] failed:", error);
		return NextResponse.json(
			{ error: "Failed to load summary" },
			{ status: 500 }
		);
	}
}

