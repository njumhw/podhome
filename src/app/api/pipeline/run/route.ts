import { NextRequest } from "next/server";

// 已停用旧Pipeline接口（包含清洗逻辑）。防止后台触发清洗。
export async function POST(req: NextRequest) {
    return new Response("Pipeline disabled: cleaning flow has been removed", { status: 410 });
}
