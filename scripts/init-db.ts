import { db } from "../src/server/db";
import { initDefaultConfigs } from "../src/server/config";

async function main() {
	console.log("🚀 开始初始化数据库...");

	try {
		// 初始化系统配置
		console.log("📝 初始化系统配置...");
		await initDefaultConfigs();
		console.log("✅ 系统配置初始化完成");

		// 创建默认管理员用户（可选）
		console.log("👤 检查是否需要创建默认管理员...");
		const adminExists = await db.user.findFirst({
			where: { role: "ADMIN" },
		});

		if (!adminExists) {
			console.log("⚠️  未找到管理员用户，请手动创建");
			console.log("   可以通过注册接口创建用户，然后在数据库中手动设置为 ADMIN 角色");
		} else {
			console.log("✅ 管理员用户已存在");
		}

		console.log("🎉 数据库初始化完成！");
	} catch (error) {
		console.error("❌ 初始化失败:", error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

main();
