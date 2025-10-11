import { NextRequest } from "next/server";

const COPIES = [
	"正在召唤文字之灵…",
	"ASR 小火车开动咯～",
	"咖啡续上，文字马上到！",
	"让我们把声音安放进文字里。",
	"清洗口头语中…咳咳、然后、就是…都没了。",
	"正在捕捉嘉宾灵魂金句。",
	"模型正在冥想，请稍候。",
	"播客搬运工上线。",
	"快了快了，就差临门一脚。",
	"把碎片揉成摘要中…",
	"别急，稳比快更重要。",
	"音轨里的想法在排队。",
	"内容校准，拒绝胡编乱造。",
	"正在查收灵感快递。",
	"金句检测器滴滴作响。",
	"让语义更清澈一点。",
	"逐字稿正在就位。",
	"摘要提炼中，保留核心论点与论据。",
	"向量化准备，就绪！",
	"QA 能力即将解锁。",
];

function pickRandom(n = 1) {
	const arr = COPIES.slice();
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr.slice(0, Math.max(1, Math.min(n, COPIES.length)));
}

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const count = Number(searchParams.get("count") || "1");
	const items = pickRandom(isNaN(count) ? 1 : count);
	return Response.json({ items });
}
