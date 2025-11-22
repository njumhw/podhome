import { db } from "../src/server/db";
import crypto from "crypto";

async function resetAdminPassword() {
	console.log("🔧 重置管理员密码...");

	try {
		// 查找管理员账号
		const user = await db.user.findUnique({
			where: { email: "njumwh@163.com" },
		});

		if (!user) {
			console.log("❌ 未找到用户: njumwh@163.com");
			return;
		}

		// 新密码
		const newPassword = "admin123456"; // 重置为默认密码
		const salt = crypto.randomBytes(16).toString("hex");
		const hash = crypto.pbkdf2Sync(newPassword, salt, 100_000, 32, "sha256").toString("hex");
		const passwordHash = `${salt}:${hash}`;

		// 更新密码
		await db.user.update({
			where: { email: "njumwh@163.com" },
			data: { passwordHash },
		});

		console.log("✅ 密码重置成功！");
		console.log(`📧 邮箱: njumwh@163.com`);
		console.log(`🔑 新密码: ${newPassword}`);
		console.log(`⚠️  请登录后立即修改密码！`);

	} catch (error) {
		console.error("❌ 重置密码失败:", error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

resetAdminPassword();



