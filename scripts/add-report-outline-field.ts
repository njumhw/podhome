import { db } from '../src/server/db';

async function addReportOutlineField() {
  try {
    console.log('开始添加 reportOutline 字段...');
    
    // 使用 Prisma 的 $executeRaw 执行 SQL
    await db.$executeRaw`
      ALTER TABLE "Podcast" 
      ADD COLUMN IF NOT EXISTS "reportOutline" TEXT;
    `;
    
    console.log('✅ reportOutline 字段添加成功！');
    
    // 验证字段是否存在
    const result = await db.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Podcast' AND column_name = 'reportOutline';
    `;
    
    console.log('验证结果:', result);
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

addReportOutlineField()
  .then(() => {
    console.log('迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  });




