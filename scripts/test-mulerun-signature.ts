/**
 * 测试 MuleRun 签名验证
 * 用于诊断签名验证失败的原因
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// 手动读取 .env 文件
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, ''); // 移除引号
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

// 从环境变量读取 Agent Key
const agentKey = process.env.MULERUN_AGENT_KEY;

if (!agentKey) {
  console.error('MULERUN_AGENT_KEY 未设置');
  process.exit(1);
}

// 从日志中提取的实际参数（用于测试）
const testParams = {
  agentId: '6fdfb3b1-b048-4b13-9127-4f42b0a878ae',
  nonce: 'f0dae613-1994-41fd-a6f2-1cfba668bb9f',
  origin: 'mulerun.com',
  sessionId: 'dddf0111-f22b-462c-90c9-97440bff8236',
  time: '1765631830',
  userId: '84a312a3ad89d1d4fe721a9af6ebcc8481a0119a450fb437c22355dbb08c06b9',
  signature: '1f06299971be7909256624b34c0415df4e7a1dc9add5cddb2f39f0586ac10a18', // 接收到的签名
};

console.log('=== MuleRun 签名验证测试 ===\n');
console.log('Agent Key 信息:');
console.log(`  长度: ${agentKey.length}`);
console.log(`  前缀: ${agentKey.substring(0, 10)}...`);
console.log(`  后缀: ...${agentKey.substring(agentKey.length - 10)}`);
console.log(`  完整值: ${agentKey}`);
console.log(`  字符编码检查: ${JSON.stringify(agentKey)}\n`);

// 移除 signature
const { signature: receivedSignature, ...paramsWithoutSig } = testParams;

// 按 key 排序
const sortedKeys = Object.keys(paramsWithoutSig).sort();
const sortedParams: Record<string, string> = {};
for (const key of sortedKeys) {
  sortedParams[key] = paramsWithoutSig[key as keyof typeof paramsWithoutSig];
}

// 序列化为 JSON
const jsonString = JSON.stringify(sortedParams);

console.log('参数处理:');
console.log(`  排序后的参数:`, sortedParams);
console.log(`  JSON 字符串: ${jsonString}`);
console.log(`  JSON 字符串长度: ${jsonString.length}`);
console.log(`  JSON 字符串字符编码: ${JSON.stringify(jsonString)}\n`);

// 计算签名
const hmac = crypto.createHmac('sha256', agentKey);
hmac.update(jsonString);
const expectedSignature = hmac.digest('hex');

console.log('签名计算:');
console.log(`  计算出的签名 (expected): ${expectedSignature}`);
console.log(`  接收到的签名 (received): ${receivedSignature}`);
console.log(`  是否匹配: ${expectedSignature === receivedSignature}\n`);

// 尝试不同的 Agent Key 变体
console.log('尝试不同的 Agent Key 变体:');
const variants = [
  { name: '原值', key: agentKey },
  { name: '去除首尾空格', key: agentKey.trim() },
  { name: '去除所有空格', key: agentKey.replace(/\s/g, '') },
];

for (const variant of variants) {
  const hmac2 = crypto.createHmac('sha256', variant.key);
  hmac2.update(jsonString);
  const sig = hmac2.digest('hex');
  const matches = sig === receivedSignature;
  console.log(`  ${variant.name}: ${sig} ${matches ? '✅ 匹配!' : '❌'}`);
}

