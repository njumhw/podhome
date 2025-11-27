#!/usr/bin/env tsx
/**
 * 诊断播客处理流程的配置问题
 */

console.log('🔍 开始诊断播客处理流程配置...\n');
console.log('========================================');

console.log('\n📋 必需的环境变量检查:');
console.log('----------------------------------------');

const requiredVars = [
  { name: 'DATABASE_URL', description: '数据库连接（必需）' },
  { name: 'ALIYUN_ACCESS_KEY_ID', description: '阿里云 Access Key ID（ASR必需）' },
  { name: 'ALIYUN_ACCESS_KEY_SECRET', description: '阿里云 Access Key Secret（ASR必需）' },
  { name: 'ALIYUN_ASR_APP_KEY', description: '阿里云 ASR App Key（ASR必需）' },
  { name: 'QWEN_API_KEY', description: '通义千问 API Key（报告生成必需）' },
];

let allConfigured = true;

for (const { name, description } of requiredVars) {
  const value = process.env[name];
  const isConfigured = !!value && value.length > 0;
  
  if (isConfigured) {
    console.log(`✅ ${name}: 已配置 (${value.substring(0, 10)}...)`);
  } else {
    console.log(`❌ ${name}: 未配置 - ${description}`);
    allConfigured = false;
  }
}

console.log('\n========================================');
console.log('\n🔧 处理流程检查:');
console.log('----------------------------------------');

// 检查ASR配置
console.log('\n1. ASR配置检查:');
const asrConfigured = !!(
  process.env.ALIYUN_ACCESS_KEY_ID &&
  process.env.ALIYUN_ACCESS_KEY_SECRET &&
  process.env.ALIYUN_ASR_APP_KEY
);
if (asrConfigured) {
  console.log('   ✅ ASR配置完整');
} else {
  console.log('   ❌ ASR配置不完整（缺少必需的环境变量）');
  allConfigured = false;
}

// 检查报告生成配置
console.log('\n2. 报告生成配置检查:');
const reportConfigured = !!process.env.QWEN_API_KEY;
if (reportConfigured) {
  console.log('   ✅ 报告生成配置完整');
} else {
  console.log('   ❌ 报告生成配置不完整（缺少 QWEN_API_KEY）');
  allConfigured = false;
}

// 检查数据库配置
console.log('\n3. 数据库配置检查:');
const dbConfigured = !!process.env.DATABASE_URL;
if (dbConfigured) {
  console.log('   ✅ 数据库配置已设置');
  console.log('   ⚠️  注意：需要实际连接测试才能确认是否可用');
} else {
  console.log('   ❌ 数据库配置未设置');
  allConfigured = false;
}

console.log('\n========================================');
console.log('\n📊 诊断结果:');
console.log('----------------------------------------');

if (allConfigured) {
  console.log('✅ 所有必需配置都已设置');
  console.log('\n💡 如果处理仍然失败，请检查:');
  console.log('   1. 查看开发服务器控制台的详细错误日志');
  console.log('   2. 检查网络连接（ASR和报告生成需要网络）');
  console.log('   3. 检查API密钥是否有效');
} else {
  console.log('❌ 发现配置问题，请修复后重试');
  console.log('\n💡 修复建议:');
  console.log('   1. 检查 .env.local 文件是否存在');
  console.log('   2. 确保所有必需的环境变量都已配置');
  console.log('   3. 重启开发服务器以使环境变量生效');
}

console.log('\n========================================\n');

