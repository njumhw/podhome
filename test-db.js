const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDb() {
  try {
    console.log('测试数据库连接...');
    
    // 测试连接
    await prisma.$connect();
    console.log('数据库连接成功');
    
    // 测试TaskQueue表
    const count = await prisma.taskQueue.count();
    console.log('TaskQueue表记录数:', count);
    
    // 测试添加任务
    const task = await prisma.taskQueue.create({
      data: {
        id: `test_${Date.now()}`,
        type: 'PODCAST_PROCESSING',
        status: 'PENDING',
        data: { url: 'https://example.com' },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    console.log('任务创建成功:', task.id);
    
    // 查询任务
    const tasks = await prisma.taskQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log('最近的任务:', tasks.map(t => ({ id: t.id, status: t.status, type: t.type })));
    
  } catch (error) {
    console.error('数据库测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDb();



