/**
 * 脚本：将指定用户升级为创作者（PODCASTER）
 * 使用方法: pnpm tsx scripts/upgrade-user-to-podcaster.ts <email或username>
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ 请提供用户邮箱或用户名');
    console.log('使用方法: pnpm tsx scripts/upgrade-user-to-podcaster.ts <email或username>');
    process.exit(1);
  }

  const identifier = args[0];
  console.log(`🔍 正在查找用户: ${identifier}\n`);

  // 尝试通过邮箱或用户名查找用户
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { username: identifier },
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    console.error(`❌ 未找到用户: ${identifier}`);
    process.exit(1);
  }

  console.log('📋 用户信息:');
  console.log(`   邮箱: ${user.email}`);
  console.log(`   用户名: ${user.username}`);
  console.log(`   当前角色: ${user.role}`);
  console.log(`   注册时间: ${user.createdAt.toLocaleString('zh-CN')}\n`);

  // 检查当前角色
  if (user.role === UserRole.PODCASTER) {
    console.log('ℹ️  用户已经是创作者，无需升级');
    await prisma.$disconnect();
    process.exit(0);
  }

  if (user.role === UserRole.PODCASTER_VIP) {
    console.log('ℹ️  用户已经是VIP创作者，无需升级');
    await prisma.$disconnect();
    process.exit(0);
  }

  if (user.role === UserRole.ADMIN) {
    console.log('⚠️  用户是管理员，不建议降级为创作者');
    await prisma.$disconnect();
    process.exit(1);
  }

  // 执行升级
  console.log('🔄 正在升级用户角色...');
  
  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.PODCASTER },
      select: {
        email: true,
        username: true,
        role: true,
      },
    });

    console.log('\n✅ 升级成功！');
    console.log(`   邮箱: ${updated.email}`);
    console.log(`   用户名: ${updated.username}`);
    console.log(`   新角色: ${updated.role}\n`);
  } catch (error) {
    console.error('❌ 升级失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('❌ 脚本执行失败:', e);
    process.exit(1);
  });


