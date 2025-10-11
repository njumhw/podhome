import { db } from "../src/server/db";
import crypto from "crypto";

async function createAdmin() {
	console.log("🚀 开始创建管理员账号...");

	try {
		// 检查是否已存在管理员
		const existingAdmin = await db.user.findFirst({
			where: { email: "njumwh@163.com" },
		});

		if (existingAdmin) {
			console.log("✅ 管理员账号已存在");
			return;
		}

		// 生成密码哈希
		const password = "admin123456"; // 默认密码
		const salt = crypto.randomBytes(16).toString("hex");
		const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
		const passwordHash = `${salt}:${hash}`;

		// 创建管理员用户
		const admin = await db.user.create({
			data: {
				email: "njumwh@163.com",
				username: "admin",
				passwordHash,
				role: "ADMIN",
				uploadCount: 0,
			},
		});

		console.log("✅ 管理员账号创建成功！");
		console.log(`📧 邮箱: ${admin.email}`);
		console.log(`👤 用户名: ${admin.username}`);
		console.log(`🔑 密码: ${password}`);
		console.log(`🆔 用户ID: ${admin.id}`);

	} catch (error) {
		console.error("❌ 创建管理员失败:", error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

createAdmin();
