import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
	try {
		console.log("🔍 登录测试 API 被调用");
		
		const json = await req.json();
		console.log("请求数据:", json);
		
		return Response.json({ 
			ok: true, 
			message: "登录测试成功",
			received: json 
		});
	} catch (error) {
		console.error("❌ 登录测试 API 错误:", error);
		return Response.json({ 
			error: "登录测试失败", 
			details: String(error) 
		}, { status: 500 });
	}
}
