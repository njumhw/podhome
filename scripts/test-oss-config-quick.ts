import { readFileSync } from 'fs';
import { resolve } from 'path';
import { uploadToOssAndGetPublicUrl } from '../src/server/storage';
import { Buffer } from 'buffer';

// 手动加载.env文件
const envPath = resolve(__dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  console.warn('无法读取.env文件，将使用process.env中的现有变量');
}

async function testOssConfigQuick() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 快速测试OSS配置');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 检查环境变量
  const env = {
    ALIYUN_ACCESS_KEY_ID: process.env.ALIYUN_ACCESS_KEY_ID,
    ALIYUN_ACCESS_KEY_SECRET: process.env.ALIYUN_ACCESS_KEY_SECRET,
    ALIYUN_OSS_REGION: process.env.ALIYUN_OSS_REGION,
    ALIYUN_OSS_BUCKET: process.env.ALIYUN_OSS_BUCKET,
  };

  console.log('=== 环境变量检查 ===');
  console.log(`ALIYUN_ACCESS_KEY_ID: ${env.ALIYUN_ACCESS_KEY_ID ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`ALIYUN_ACCESS_KEY_SECRET: ${env.ALIYUN_ACCESS_KEY_SECRET ? '✅ 已设置' : '❌ 未设置'}`);
  console.log(`ALIYUN_OSS_REGION: ${env.ALIYUN_OSS_REGION || '❌ 未设置'}`);
  console.log(`ALIYUN_OSS_BUCKET: ${env.ALIYUN_OSS_BUCKET || '❌ 未设置'}`);
  console.log('');

  if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET || !env.ALIYUN_OSS_REGION || !env.ALIYUN_OSS_BUCKET) {
    console.error('❌ OSS环境变量不完整，无法测试');
    process.exit(1);
  }

  // 测试上传一个小文件
  console.log('=== 测试OSS上传 ===');
  const testContent = Buffer.from('Hello, OSS! This is a test file.');
  const testPath = `test/${Date.now()}-test.txt`;
  
  console.log(`测试文件路径: ${testPath}`);
  console.log(`测试文件大小: ${testContent.length} 字节`);
  console.log('开始上传...\n');

  try {
    const url = await uploadToOssAndGetPublicUrl(testPath, testContent, 'text/plain');
    
    if (url) {
      console.log('✅ OSS上传成功！');
      console.log(`公共URL: ${url}`);
      console.log('\n✅ OSS配置正常，可以正常上传文件');
    } else {
      console.error('❌ OSS上传失败：返回null');
      console.error('   请检查服务器日志中的详细错误信息');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ OSS上传异常:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack.substring(0, 500));
    }
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
}

testOssConfigQuick().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});

