const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== 用户体系统计 ===\n');

  // 按角色统计
  const roleStats = await prisma.user.groupBy({
    by: ['role'],
    _count: true,
  });

  console.log('📊 按角色统计:');
  roleStats.forEach(stat => {
    console.log(`  ${stat.role}: ${stat._count} 人`);
  });

  // 按封禁状态统计
  const banStats = await prisma.user.groupBy({
    by: ['isBanned'],
    _count: true,
  });

  console.log('\n📊 按封禁状态统计:');
  banStats.forEach(stat => {
    console.log(`  ${stat.isBanned ? '已封禁' : '正常'}: ${stat._count} 人`);
  });

  // 详细统计：角色 + 封禁状态
  const detailedStats = await prisma.user.groupBy({
    by: ['role', 'isBanned'],
    _count: true,
  });

  console.log('\n📊 详细统计（角色 × 封禁状态）:');
  detailedStats.forEach(stat => {
    const status = stat.isBanned ? '已封禁' : '正常';
    console.log(`  ${stat.role} (${status}): ${stat._count} 人`);
  });

  // 上传次数分布
  const uploadStats = await prisma.user.findMany({
    select: {
      role: true,
      uploadCount: true,
      _count: {
        select: { podcasts: true }
      }
    }
  });

  console.log('\n📊 上传次数统计:');
  const roleUploadStats = {};
  uploadStats.forEach(user => {
    const role = user.role;
    if (!roleUploadStats[role]) {
      roleUploadStats[role] = {
        total: 0,
        withUploads: 0,
        totalUploads: 0,
        maxUploads: 0,
        minUploads: Infinity
      };
    }
    const realUploadCount = user.uploadCount > 0 ? user.uploadCount : user._count.podcasts;
    roleUploadStats[role].total++;
    roleUploadStats[role].totalUploads += realUploadCount;
    if (realUploadCount > 0) {
      roleUploadStats[role].withUploads++;
    }
    if (realUploadCount > roleUploadStats[role].maxUploads) {
      roleUploadStats[role].maxUploads = realUploadCount;
    }
    if (realUploadCount < roleUploadStats[role].minUploads) {
      roleUploadStats[role].minUploads = realUploadCount;
    }
  });

  Object.entries(roleUploadStats).forEach(([role, stats]) => {
    const avg = stats.total > 0 ? (stats.totalUploads / stats.total).toFixed(2) : 0;
    console.log(`\n  ${role}:`);
    console.log(`    总人数: ${stats.total}`);
    console.log(`    有上传记录: ${stats.withUploads} 人 (${((stats.withUploads / stats.total) * 100).toFixed(1)}%)`);
    console.log(`    总上传次数: ${stats.totalUploads}`);
    console.log(`    平均上传次数: ${avg}`);
    console.log(`    最多上传: ${stats.maxUploads}`);
    console.log(`    最少上传: ${stats.minUploads === Infinity ? 0 : stats.minUploads}`);
  });

  // 最近登录统计
  const loginStats = await prisma.user.groupBy({
    by: ['role'],
    _count: {
      lastLoginAt: true
    },
    where: {
      lastLoginAt: {
        not: null
      }
    }
  });

  console.log('\n📊 最近登录统计:');
  const totalUsers = await prisma.user.count();
  const usersWithLogin = await prisma.user.count({
    where: {
      lastLoginAt: { not: null }
    }
  });
  console.log(`  总用户数: ${totalUsers}`);
  console.log(`  有登录记录: ${usersWithLogin} 人 (${((usersWithLogin / totalUsers) * 100).toFixed(1)}%)`);
  console.log(`  从未登录: ${totalUsers - usersWithLogin} 人`);

  // 注册时间分布（最近30天）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentUsers = await prisma.user.count({
    where: {
      createdAt: { gte: thirtyDaysAgo }
    }
  });

  console.log('\n📊 注册时间分布:');
  console.log(`  最近30天注册: ${recentUsers} 人`);

  // 活跃用户统计（有上传或最近登录）
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const activeUsers = await prisma.user.count({
    where: {
      OR: [
        { lastLoginAt: { gte: sevenDaysAgo } },
        { podcasts: { some: { createdAt: { gte: sevenDaysAgo } } } }
      ]
    }
  });

  console.log('\n📊 活跃用户统计（最近7天）:');
  console.log(`  活跃用户: ${activeUsers} 人 (${((activeUsers / totalUsers) * 100).toFixed(1)}%)`);

  await prisma.$disconnect();
}

main().catch(console.error);

