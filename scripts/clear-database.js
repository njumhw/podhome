#!/usr/bin/env node

/**
 * 清空数据库脚本
 * 删除所有AudioCache和ApiUsageLog数据，保留用户数据
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('开始清空数据库...');
  
  try {
    // 删除AudioCache表的所有数据
    const audioCacheResult = await prisma.audioCache.deleteMany({});
    console.log(`删除了 ${audioCacheResult.count} 条AudioCache记录`);
    
    // 删除ApiUsageLog表的所有数据
    const apiUsageResult = await prisma.apiUsageLog.deleteMany({});
    console.log(`删除了 ${apiUsageResult.count} 条ApiUsageLog记录`);
    
    // 可选：删除其他相关表的数据
    // const podcastResult = await prisma.podcast.deleteMany({});
    // console.log(`删除了 ${podcastResult.count} 条Podcast记录`);
    
    console.log('数据库清空完成！');
    console.log('现在可以重新测试用户体验了。');
    
  } catch (error) {
    console.error('清空数据库时出现错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行清空操作
clearDatabase();
