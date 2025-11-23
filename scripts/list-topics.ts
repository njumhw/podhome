/**
 * 列出所有主题标签的脚本
 */
/// <reference types="node" />
import { db } from '../src/server/db';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📚 当前标签库');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // 获取所有主题
    const allTopics = await db.topic.findMany({
      orderBy: [
        { approved: 'desc' }, // 已审核的在前
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        approved: true,
        createdAt: true,
        _count: {
          select: {
            podcasts: true,
          },
        },
      },
    });
    
    if (allTopics.length === 0) {
      console.log('❌ 当前没有任何主题标签\n');
      return;
    }
    
    // 已审核的主题
    const approvedTopics = allTopics.filter(t => t.approved);
    const pendingTopics = allTopics.filter(t => !t.approved);
    
    console.log(`📊 总计: ${allTopics.length} 个主题`);
    console.log(`✅ 已审核: ${approvedTopics.length} 个`);
    console.log(`⏳ 待审核: ${pendingTopics.length} 个\n`);
    
    if (approvedTopics.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ 已审核的主题（可用于自动标注）');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      approvedTopics.forEach((topic, index) => {
        const colorDisplay = topic.color 
          ? `\x1b[38;2;${parseColorToRgb(topic.color)}\x1b[0m` 
          : '';
        const colorTag = topic.color ? `[${topic.color}]` : '[无颜色]';
        
        console.log(`${index + 1}. ${topic.name} ${colorTag}`);
        if (topic.description) {
          console.log(`   描述: ${topic.description}`);
        }
        console.log(`   使用次数: ${topic._count.podcasts} 个播客`);
        console.log(`   创建时间: ${topic.createdAt.toLocaleString('zh-CN')}`);
        console.log('');
      });
    }
    
    if (pendingTopics.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('⏳ 待审核的主题（不可用于自动标注）');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      pendingTopics.forEach((topic, index) => {
        console.log(`${index + 1}. ${topic.name}`);
        if (topic.description) {
          console.log(`   描述: ${topic.description}`);
        }
        console.log(`   使用次数: ${topic._count.podcasts} 个播客`);
        console.log(`   创建时间: ${topic.createdAt.toLocaleString('zh-CN')}`);
        console.log('');
      });
    }
    
    // 统计信息
    const totalPodcasts = approvedTopics.reduce((sum, t) => sum + t._count.podcasts, 0);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📈 统计信息');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`已审核主题的播客总数: ${totalPodcasts} 个`);
    console.log(`平均每个主题的播客数: ${approvedTopics.length > 0 ? (totalPodcasts / approvedTopics.length).toFixed(1) : 0} 个\n`);
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// 将颜色代码转换为RGB（简单处理）
function parseColorToRgb(color: string): string {
  // 如果是十六进制颜色，转换为RGB
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r};${g};${b}`;
  }
  // 如果是rgb格式
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return `${match[0]};${match[1]};${match[2]}`;
    }
  }
  return '255;255;255'; // 默认白色
}

main();

