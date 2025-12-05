import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 开始用户角色迁移...\n');

  // 1. 将所有 USER 角色升级为 PODCASTER
  const userCount = await prisma.user.count({
    where: { role: 'USER' }
  });

  if (userCount > 0) {
    const result = await prisma.user.updateMany({
      where: { role: 'USER' },
      data: { role: 'PODCASTER' }
    });
    console.log(`✅ 已将 ${result.count} 个 USER 角色升级为 PODCASTER`);
  } else {
    console.log('ℹ️  没有需要迁移的 USER 角色');
  }

  // 2. 检查 ADMIN 角色（保持不变）
  const adminCount = await prisma.user.count({
    where: { role: 'ADMIN' }
  });
  console.log(`ℹ️  ${adminCount} 个 ADMIN 角色保持不变\n`);

  // 3. 统计迁移后的角色分布
  const roleStats = await prisma.user.groupBy({
    by: ['role'],
    _count: true
  });

  console.log('📊 迁移后的角色分布:');
  roleStats.forEach(stat => {
    console.log(`  ${stat.role}: ${stat._count} 人`);
  });

  console.log('\n✅ 用户角色迁移完成！');
}

main()
  .catch((e) => {
    console.error('❌ 迁移失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


