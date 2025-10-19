import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { getConfig, setConfig } from "@/server/config";
import { z } from "zod";

const configSchema = z.object({
	segmentDuration: z.number().min(10).max(180),
	enableAutoSegment: z.boolean(),
	maxConcurrentSegments: z.number().min(1).max(20),
});

export async function GET(req: NextRequest) {
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

	try {
		const config = {
			segmentDuration: parseInt((await getConfig("AUDIO_SEGMENT_DURATION", "170")) || "170"),
			enableAutoSegment: ((await getConfig("AUDIO_AUTO_SEGMENT", "true")) || "true") === "true",
			maxConcurrentSegments: parseInt((await getConfig("AUDIO_MAX_CONCURRENT", "3")) || "3"),
		};

		return Response.json({ config });
	} catch (error: unknown) {
		return new Response(error.message, { status: 500 });
	}
}

export async function PATCH(req: NextRequest) {
	const user = await requireUser();
	if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

	const json = await req.json().catch(() => null);
	const parsed = configSchema.safeParse(json);
	if (!parsed.success) return new Response("Invalid config", { status: 400 });

	const { segmentDuration, enableAutoSegment, maxConcurrentSegments } = parsed.data;

	try {
		await setConfig("AUDIO_SEGMENT_DURATION", segmentDuration.toString());
		await setConfig("AUDIO_AUTO_SEGMENT", enableAutoSegment.toString());
		await setConfig("AUDIO_MAX_CONCURRENT", maxConcurrentSegments.toString());

		return Response.json({ success: true });
	} catch (error: unknown) {
		return new Response(error.message, { status: 500 });
	}
}
