import { generateReportWhole } from './src/clients/report-generator';

async function testOutlineGeneration() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('测试大纲生成API');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 使用一个简短的测试文本
  const testTranscript = `本期播客讨论了人工智能的发展趋势。首先，我们探讨了GPT模型的技术突破，包括其强大的语言理解能力和生成能力。其次，我们分析了AI在各个行业的应用，特别是在医疗、教育和金融领域的创新。最后，我们讨论了AI发展面临的挑战，包括数据隐私、算法偏见和就业影响等问题。`;
  
  console.log(`测试文本长度: ${testTranscript.length} 字符\n`);
  
  try {
    console.log('开始调用 generateReportWhole...\n');
    const result = await generateReportWhole({
      transcript: testTranscript,
      title: '测试播客：AI发展趋势',
    });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('测试结果:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ 处理成功！`);
    console.log(`处理时间: ${(result.processingTime / 1000).toFixed(1)}秒`);
    console.log(`估算Token: ${result.estimatedTokens}`);
    console.log(`\n是否有大纲: ${result.outline ? '✅ 是' : '❌ 否'}`);
    
    if (result.outline) {
      console.log(`大纲长度: ${result.outline.length} 字符`);
      console.log(`\n大纲内容预览（前500字符）:`);
      console.log('─'.repeat(60));
      console.log(result.outline.substring(0, 500));
      console.log('─'.repeat(60));
    } else {
      console.log('\n⚠️ 警告：没有生成大纲，可能走了回退路径！');
    }
    
    console.log(`\n是否有总结: ${result.summary ? '✅ 是' : '❌ 否'}`);
    if (result.summary) {
      console.log(`总结长度: ${result.summary.length} 字符`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    
    if (result.outline) {
      console.log('✅ 测试通过：大纲生成API工作正常！');
      process.exit(0);
    } else {
      console.log('❌ 测试失败：大纲生成API未返回大纲！');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ 测试失败：发生错误');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('错误信息:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\n错误堆栈:');
      console.error(error.stack.substring(0, 1000));
    }
    process.exit(1);
  }
}

testOutlineGeneration();




