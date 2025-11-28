import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function testPodcastQuery() {
  try {
    console.log('🔍 测试数据库连接...');
    
    // 1. 测试基本连接
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ 数据库连接正常\n');
    
    // 2. 查询播客总数
    const totalCount = await prisma.podcast.count();
    console.log(`📊 Podcast表总数: ${totalCount}`);
    
    // 3. 查询前5个播客的ID
    const podcasts = await prisma.podcast.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    
    console.log(`\n📋 前5个播客:`);
    podcasts.forEach((p, i) => {
      console.log(`  ${i + 1}. ID: ${p.id}, 标题: ${p.title?.substring(0, 30)}..., 状态: ${p.status}`);
    });
    
    // 4. 测试查询单个播客
    if (podcasts.length > 0) {
      const testId = podcasts[0].id;
      console.log(`\n🔍 测试查询播客 ID: ${testId}`);
      
      const podcast = await prisma.podcast.findFirst({
        where: { id: testId },
        select: {
          id: true,
          title: true,
          showAuthor: true,
          publishedAt: true,
          audioUrl: true,
          sourceUrl: true,
          summary: true,
          topic: { select: { name: true } },
          updatedAt: true,
        },
      });
      
      if (podcast) {
        console.log('✅ 播客查询成功');
        console.log(`   标题: ${podcast.title}`);
        console.log(`   作者: ${podcast.showAuthor}`);
        console.log(`   主题: ${podcast.topic?.name || '无'}`);
      } else {
        console.log('❌ 播客查询失败：未找到');
      }
    }
    
    // 5. 检查AudioCache表
    const audioCacheCount = await prisma.audioCache.count();
    console.log(`\n📊 AudioCache表总数: ${audioCacheCount}`);
    
    if (audioCacheCount > 0) {
      const audioCaches = await prisma.audioCache.findMany({
        take: 3,
        select: {
          id: true,
          title: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
      
      console.log(`\n📋 AudioCache表前3个:`);
      audioCaches.forEach((a, i) => {
        console.log(`  ${i + 1}. ID: ${a.id}, 标题: ${a.title?.substring(0, 30)}...`);
      });
    }
    
    console.log('\n✅ 测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code;
    console.error(`   错误类型: ${error instanceof Error ? error.name : 'Unknown'}`);
    console.error(`   错误代码: ${errorCode || 'N/A'}`);
    console.error(`   错误信息: ${errorMessage}`);
    
    if (errorMessage.includes('Can\'t reach database server') || 
        errorMessage.includes('P1001')) {
      console.error('\n⚠️  数据库连接失败，请检查:');
      console.error('   1. DATABASE_URL 是否正确');
      console.error('   2. 数据库服务器是否可访问');
      console.error('   3. 网络连接是否正常');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testPodcastQuery();

