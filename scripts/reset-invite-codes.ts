import { db } from "../src/server/db";

async function resetInviteCodes() {
	console.log("🚀 开始重置邀请码...");

	try {
		// 删除所有现有的邀请码
		await db.inviteCode.deleteMany({});
		console.log("✅ 已删除所有现有邀请码");

		// 创建新的一次性邀请码
		const inviteCodes = [
			{ code: "WELCOME2024", maxUses: 1, expiresAt: null },
			{ code: "BETA2024", maxUses: 1, expiresAt: null },
			{ code: "FRIEND2024", maxUses: 1, expiresAt: null },
			{ code: "TEAM2024", maxUses: 1, expiresAt: null },
			{ code: "GUEST2024", maxUses: 1, expiresAt: null },
		];

		for (const inviteData of inviteCodes) {
			await db.inviteCode.create({
				data: inviteData,
			});
			console.log(`✅ 邀请码创建成功: ${inviteData.code} (一次性使用)`);
		}

		console.log("🎉 所有邀请码重置完成！");
		console.log("📝 可用的邀请码 (每个只能使用一次):");
		console.log("   - WELCOME2024");
		console.log("   - BETA2024");
		console.log("   - FRIEND2024");
		console.log("   - TEAM2024");
		console.log("   - GUEST2024");

	} catch (error) {
		console.error("❌ 重置邀请码失败:", error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

resetInviteCodes();
