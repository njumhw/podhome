/**
 * 将AI标签合并到科技标签的脚本
 */

import { db } from '../src/server/db';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 合并AI标签到科技标签');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    const aiTopic = await db.topic.findUnique({
      where: { name: 'AI' },
      include: {
        podcasts: {
          select: { id: true },
        },
      },
    });
    
    const techTopic = await db.topic.findUnique({
      where: { name: '科技' },
    });
    
    if (!techTopic) {
      console.error('❌ 科技标签不存在，请先运行 create-topics.ts');
      process.exit(1);
    }
    
    if (aiTopic) {
      // 如果有播客使用AI标签，先迁移到科技标签
      if (aiTopic.podcasts.length > 0) {
        console.log(`📦 发现 ${aiTopic.podcasts.length} 个播客使用AI标签，迁移到科技标签...`);
        await db.podcast.updateMany({
          where: { topicId: aiTopic.id },
          data: { topicId: techTopic.id },
        });
        console.log('✅ 播客迁移完成');
      }
      
      // 删除AI标签
      await db.topic.delete({
        where: { name: 'AI' },
      });
      console.log('✅ 已删除AI标签');
    } else {
      console.log('ℹ️  AI标签不存在，无需合并');
    }
    
    console.log('\n✅ 合并完成！\n');
    
  } catch (error) {
    console.error('❌ 合并失败:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();


