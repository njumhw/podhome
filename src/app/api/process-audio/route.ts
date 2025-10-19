import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError } from "@/utils/http";
import { getSessionUser } from "@/server/auth";
import { processAudioInternal } from "@/server/audio-processor";

const bodySchema = z.object({
	url: z.string().url(),
});

export async function POST(req: NextRequest) {
	const startTime = Date.now();
	
	try {
		const body = await req.json().catch(() => ({}));
		const validation = bodySchema.safeParse(body);
		
		if (!validation.success) {
			return jsonError("无效的请求参数", 400);
		}
		
		const { url } = validation.data;
		const user = await getSessionUser();
		
		if (!user) {
			return jsonError("需要登录", 401);
		}
		
		console.log(`开始处理播客链接: ${url}`);
		
		// 调用内部处理函数
		const result = await processAudioInternal(url, user.id);
		
		return Response.json({
			success: true,
			message: "播客处理完成",
			data: result,
			processingTime: Date.now() - startTime
		});
		
	} catch (error: unknown) {
		console.error("播客处理失败:", error);
		return jsonError(
			`播客处理失败: ${error instanceof Error ? error.message : String(error)}`,
			500
		);
	}
}