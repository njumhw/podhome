/**
 * 批量自动标注播客主题的脚本
 * 
 * 使用方法:
 * - 标注所有未标注的播客: npx tsx scripts/auto-tag-podcasts.ts
 * - 预览模式（不实际更新）: npx tsx scripts/auto-tag-podcasts.ts --dry-run
 * - 标注指定播客: npx tsx scripts/auto-tag-podcasts.ts --ids podcast1,podcast2,...
 */

import { batchAutoTagPodcasts } from '../src/server/topic-auto-tagger';
import { db } from '../src/server/db';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const idsArg = args.find(arg => arg.startsWith('--ids='));
  const podcastIds = idsArg ? idsArg.split('=')[1].split(',').map(id => id.trim()) : undefined;
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 开始自动标注播客主题');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (dryRun) {
    console.log('⚠️  预览模式：不会实际更新数据库\n');
  }
  
  if (podcastIds) {
    console.log(`📋 指定播客ID: ${podcastIds.join(', ')}\n`);
  } else {
    console.log('📋 处理所有已就绪的播客（包括已有标签的）\n');
  }
  
  console.log('📌 每个播客只标注1个标签\n');
  
  try {
    const result = await batchAutoTagPodcasts(podcastIds, dryRun);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 标注结果统计');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`总计: ${result.total} 个播客`);
    console.log(`已标注: ${result.tagged} 个`);
    console.log(`跳过: ${result.skipped} 个\n`);
    
    if (result.tagged > 0) {
      console.log('✅ 成功标注的播客（前15个）:');
      result.results
        .filter(r => r.topicName)
        .slice(0, 15)
        .forEach(r => {
          console.log(`   - ${r.title.substring(0, 50)}... → ${r.topicName}`);
        });
      if (result.tagged > 15) {
        console.log(`   ... 还有 ${result.tagged - 15} 个`);
      }
      console.log('');
    }
    
    if (result.skipped > 0 && result.results.filter(r => !r.topicName).length > 0) {
      console.log('⏭️  未匹配的播客（前5个）:');
      result.results
        .filter(r => !r.topicName)
        .slice(0, 5)
        .forEach(r => {
          console.log(`   - ${r.title.substring(0, 50)}...`);
        });
      console.log('');
    }
    
    if (!dryRun && result.tagged > 0) {
      console.log('✅ 标注完成！数据库已更新。\n');
    } else if (dryRun) {
      console.log('💡 这是预览结果。要实际执行标注，请移除 --dry-run 参数。\n');
    }
    
  } catch (error) {
    console.error('❌ 自动标注失败:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();

