// 手动加载环境变量（Next.js会自动加载，但独立脚本需要手动处理）
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
        // 移除引号
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
  console.error('❌ 无法读取.env文件:', error);
}

import { uploadToOssAndGetPublicUrl } from '../src/server/storage';

async function testConcurrentUpload() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 测试OSS并发上传（模拟实际场景）');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 模拟22个音频分段（和实际场景一致）
  const segmentCount = 22;
  const segmentSize = 100 * 1024; // 每个分段约100KB（模拟音频片段）
  
  console.log(`准备并发上传 ${segmentCount} 个测试分段（每个 ${(segmentSize / 1024).toFixed(0)} KB）...\n`);

  const segments = Array.from({ length: segmentCount }).map((_, i) => ({
    index: i,
    path: `test/concurrent-upload-segment-${i}-${Date.now()}.m4a`,
    content: Buffer.alloc(segmentSize, i % 256) // 填充不同字节值以便区分
  }));

  // 并发上传（模拟实际场景的并发数）
  const maxConcurrent = 3;
  const results: Array<{ index: number; success: boolean; url?: string; error?: string }> = [];
  
  async function runPool<T>(items: typeof segments, worker: (it: typeof segments[0]) => Promise<T>, n: number) {
    const ret: T[] = new Array(items.length) as any;
    let p = 0;
    const running: Promise<void>[] = [];
    async function next() {
      const i = p++;
      if (i >= items.length) return;
      ret[i] = await worker(items[i]);
      return next();
    }
    for (let i = 0; i < Math.min(n, items.length); i++) running.push(next() as any);
    await Promise.all(running);
    return ret;
  }

  console.log(`开始并发上传（并发数: ${maxConcurrent}）...\n`);
  const startTime = Date.now();

  try {
    const uploadResults = await runPool(segments, async (segment) => {
      try {
        console.log(`[${segment.index + 1}/${segmentCount}] 开始上传: ${segment.path}`);
        const url = await uploadToOssAndGetPublicUrl(segment.path, segment.content, 'audio/mp4');
        
        if (!url) {
          console.error(`[${segment.index + 1}/${segmentCount}] ❌ 上传失败: ${segment.path}`);
          return { index: segment.index, success: false, error: 'uploadToOssAndGetPublicUrl returned null' };
        }
        
        console.log(`[${segment.index + 1}/${segmentCount}] ✅ 上传成功: ${url.substring(0, 80)}...`);
        return { index: segment.index, success: true, url };
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[${segment.index + 1}/${segmentCount}] ❌ 上传异常: ${errorMsg}`);
        return { index: segment.index, success: false, error: errorMsg };
      }
    }, maxConcurrent);

    const elapsed = Date.now() - startTime;
    const successful = uploadResults.filter(r => r.success).length;
    const failed = uploadResults.filter(r => !r.success).length;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 测试结果');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`总分段数: ${segmentCount}`);
    console.log(`成功: ${successful}`);
    console.log(`失败: ${failed}`);
    console.log(`耗时: ${(elapsed / 1000).toFixed(2)} 秒`);
    console.log(`平均速度: ${(successful / (elapsed / 1000)).toFixed(2)} 个/秒\n`);

    if (failed > 0) {
      console.log('❌ 失败的分段详情:');
      uploadResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  分段 ${r.index + 1}: ${r.error}`);
        });
      console.log('');
    }

    if (failed === segmentCount) {
      console.error('❌ 所有分段上传均失败！');
      console.error('可能原因：');
      console.error('1. OSS配置错误（AccessKey、Bucket、Region）');
      console.error('2. OSS权限问题（AccessKey没有上传权限）');
      console.error('3. 网络连接问题');
      console.error('4. OSS服务异常');
      console.error('\n请检查开发服务器控制台中的详细OSS错误信息！');
      process.exit(1);
    } else if (failed > 0) {
      console.warn(`⚠️ ${failed} 个分段上传失败，但 ${successful} 个成功`);
    } else {
      console.log('✅ 所有分段上传成功！');
    }

    // 清理测试文件
    console.log('\n清理测试文件...');
    // 注意：这里不清理，保留文件以便后续检查
    console.log('测试文件已保留在OSS中，路径: test/concurrent-upload-segment-*.m4a');

  } catch (error: any) {
    console.error('❌ 测试过程异常:', error);
    process.exit(1);
  }
}

testConcurrentUpload().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});

