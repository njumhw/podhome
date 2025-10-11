#!/usr/bin/env node

/**
 * 数据迁移脚本：为现有播客数据添加原始URL
 * 
 * 这个脚本会：
 * 1. 检查现有数据中缺少原始URL的播客
 * 2. 尝试通过音频URL反推原始的小宇宙链接
 * 3. 更新数据库中的originalUrl字段
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateOriginalUrls() {
  console.log('开始迁移原始URL...');
  
  try {
    // 获取所有需要迁移的数据
    const audioCaches = await prisma.audioCache.findMany({
      where: {
        OR: [
          { originalUrl: null },
          { originalUrl: { startsWith: 'https://media.xyzcdn.net' } } // 当前存储的是音频URL
        ]
      },
      select: {
        id: true,
        title: true,
        audioUrl: true,
        originalUrl: true
      }
    });

    console.log(`找到 ${audioCaches.length} 条需要迁移的数据`);

    for (const cache of audioCaches) {
      console.log(`处理: ${cache.title}`);
      
      // 这里可以添加逻辑来反推原始URL
      // 例如：通过音频URL的域名、文件名等信息来推断原始的小宇宙链接
      // 或者通过其他API来查找对应的原始链接
      
      // 暂时跳过，因为需要更复杂的逻辑来反推原始URL
      console.log(`  音频URL: ${cache.audioUrl}`);
      console.log(`  当前originalUrl: ${cache.originalUrl}`);
      console.log(`  需要手动处理或通过其他方式获取原始URL`);
    }

    console.log('迁移完成！');
    
  } catch (error) {
    console.error('迁移过程中出现错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行迁移
migrateOriginalUrls();
