import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function fixAdmin() {
  console.log("🔧 修复管理员账号...");
  
  // 查找 njumwh@163.com 用户
  const user = await db.user.findUnique({
    where: { email: "njumwh@163.com" }
  });
  
  if (!user) {
    console.log("❌ 未找到用户 njumwh@163.com");
    return;
  }
  
  // 更新为管理员
  await db.user.update({
    where: { email: "njumwh@163.com" },
    data: { 
      role: "ADMIN",
      isBanned: false 
    }
  });
  
  console.log("✅ 已将 njumwh@163.com 设置为管理员");
  
  await db.$disconnect();
}

fixAdmin().catch(console.error);
