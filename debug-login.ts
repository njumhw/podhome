import { getEnv } from "./src/utils/env";
import { db } from "./src/server/db";

async function debugLogin() {
	try {
		console.log("🔍 开始调试登录问题...");
		
		// 检查环境变量
		console.log("1. 检查环境变量...");
		const env = getEnv();
		console.log("✅ 环境变量正常");
		
		// 检查数据库连接
		console.log("2. 检查数据库连接...");
		const user = await db.user.findFirst({
			where: { email: "njumwh@163.com" },
		});
		console.log("✅ 数据库连接正常");
		console.log("用户信息:", user ? "找到用户" : "未找到用户");
		
		if (user) {
			console.log("用户详情:", {
				id: user.id,
				email: user.email,
				username: user.username,
				role: user.role,
				isBanned: user.isBanned,
			});
		}
		
	} catch (error) {
		console.error("❌ 调试过程中出错:", error);
	} finally {
		await db.$disconnect();
	}
}

debugLogin();
