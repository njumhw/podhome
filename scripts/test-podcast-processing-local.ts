import { readFileSync } from 'fs';
import { resolve } from 'path';
import { processAudioInternal } from '../src/server/audio-processor';

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
  console.log('✅ 环境变量已加载');
} catch (error) {
  console.warn('无法读取.env文件，将使用process.env中的现有变量');
}

async function testPodcastProcessing() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 测试播客处理流程（本地）');
  console.log('═══════════════════════════════════════════════════════════\n');

  const url = 'https://www.xiaoyuzhoufm.com/episode/6935c8483fec3166cfc5d162';
  console.log(`播客URL: ${url}\n`);

  // 检查环境变量
  console.log('=== 环境变量检查 ===');
  const envCheck = {
    ALIYUN_ACCESS_KEY_ID: !!process.env.ALIYUN_ACCESS_KEY_ID,
    ALIYUN_ACCESS_KEY_SECRET: !!process.env.ALIYUN_ACCESS_KEY_SECRET,
    ALIYUN_OSS_REGION: !!process.env.ALIYUN_OSS_REGION,
    ALIYUN_OSS_BUCKET: !!process.env.ALIYUN_OSS_BUCKET,
  };
  console.log(envCheck);
  console.log('');

  if (!envCheck.ALIYUN_ACCESS_KEY_ID || !envCheck.ALIYUN_ACCESS_KEY_SECRET || 
      !envCheck.ALIYUN_OSS_REGION || !envCheck.ALIYUN_OSS_BUCKET) {
    console.error('❌ OSS环境变量不完整，无法测试');
    process.exit(1);
  }

  console.log('=== 开始处理播客 ===');
  console.log('注意：这将实际处理播客，可能需要几分钟时间\n');

  try {
    const result = await processAudioInternal(url, undefined, `test-${Date.now()}`);
    console.log('\n✅ 播客处理成功！');
    console.log('结果:', result ? '有结果' : '无结果');
  } catch (error: any) {
    console.error('\n❌ 播客处理失败:');
    console.error('错误信息:', error.message);
    if (error.stack) {
      console.error('错误堆栈:', error.stack.substring(0, 1000));
    }
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
}

testPodcastProcessing().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});

