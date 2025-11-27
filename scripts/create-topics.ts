/**
 * 创建/更新主题标签的脚本
 * 根据扩展方案创建缺失的标签
 */

import { db } from '../src/server/db';

const TOPICS_TO_CREATE = [
  {
    name: '科技',
    description: '人工智能、机器学习、技术、编程、互联网',
    color: '#3B82F6', // 蓝色
    approved: true,
  },
  {
    name: '管理',
    description: '企业管理、组织管理、领导力',
    color: '#374151', // 灰色
    approved: true,
  },
  {
    name: '投资',
    description: '投资理财、股票、基金、资产配置',
    color: '#10B981', // 绿色
    approved: true,
  },
  {
    name: '商业',
    description: '创业、商业模式、市场、营销',
    color: '#F59E0B', // 橙色
    approved: true,
  },
  {
    name: '教育',
    description: '学习、课程、培训、知识',
    color: '#1E40AF', // 深蓝
    approved: true,
  },
  {
    name: '文化',
    description: '历史、文学、艺术、哲学',
    color: '#EC4899', // 粉色
    approved: true,
  },
  {
    name: '健康',
    description: '医疗、养生、运动、心理',
    color: '#EF4444', // 红色
    approved: true,
  },
  {
    name: '生命',
    description: '生命科学、生物学、医学研究',
    color: '#06B6D4', // 青色
    approved: true,
  },
  {
    name: '生活',
    description: '生活方式、日常、习惯',
    color: '#84CC16', // 黄绿
    approved: true,
  },
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 创建/更新主题标签');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    for (const topicData of TOPICS_TO_CREATE) {
      const existing = await db.topic.findUnique({
        where: { name: topicData.name },
      });
      
      if (existing) {
        // 更新现有标签
        const updated = await db.topic.update({
          where: { name: topicData.name },
          data: {
            description: topicData.description,
            color: topicData.color,
            approved: topicData.approved,
          },
        });
        console.log(`✅ 更新标签: ${updated.name} (${updated.color})`);
      } else {
        // 创建新标签
        const created = await db.topic.create({
          data: topicData,
        });
        console.log(`✨ 创建标签: ${created.name} (${created.color})`);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 最终标签列表');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const allTopics = await db.topic.findMany({
      where: { approved: true },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        color: true,
        description: true,
        _count: { select: { podcasts: true } },
      },
    });
    
    allTopics.forEach((topic, index) => {
      console.log(`${index + 1}. ${topic.name} [${topic.color}]`);
      if (topic.description) {
        console.log(`   描述: ${topic.description}`);
      }
      console.log(`   使用次数: ${topic._count.podcasts} 个播客\n`);
    });
    
    console.log('✅ 标签创建/更新完成！\n');
    
  } catch (error) {
    console.error('❌ 创建标签失败:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();


