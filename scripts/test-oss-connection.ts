import OSS from 'ali-oss';

const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
const region = process.env.ALIYUN_OSS_REGION;
const bucket = process.env.ALIYUN_OSS_BUCKET;

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 测试OSS连接');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('环境变量检查:');
console.log(`  ALIYUN_ACCESS_KEY_ID: ${accessKeyId ? `✅ (长度: ${accessKeyId.length})` : '❌ 未设置'}`);
console.log(`  ALIYUN_ACCESS_KEY_SECRET: ${accessKeySecret ? `✅ (长度: ${accessKeySecret.length})` : '❌ 未设置'}`);
console.log(`  ALIYUN_OSS_REGION: ${region || '❌ 未设置'}`);
console.log(`  ALIYUN_OSS_BUCKET: ${bucket || '❌ 未设置'}\n`);

async function testOSS() {
  if (!accessKeyId || !accessKeySecret || !region || !bucket) {
    console.error('❌ OSS环境变量不完整，无法测试');
    process.exit(1);
  }

  try {
    const ossRegion = region.startsWith('oss-') ? region : `oss-${region}`;
    console.log(`创建OSS客户端 (region: ${ossRegion}, bucket: ${bucket})...`);
    
    const client = new OSS({
      accessKeyId,
      accessKeySecret,
      region: ossRegion,
      bucket,
      timeout: 60000,
      secure: true,
    });
    
    console.log('✅ OSS客户端创建成功\n');
    
    // 测试上传一个小文件
    const testKey = `test/connection-test-${Date.now()}.txt`;
    const testContent = Buffer.from('OSS connection test');
    
    console.log(`测试上传文件: ${testKey}...`);
    const result = await client.put(testKey, testContent, {
      headers: {
        'Content-Type': 'text/plain',
      }
    });
    
    console.log('✅ 文件上传成功');
    console.log(`   URL: ${result.url}`);
    console.log(`   状态: ${result.res?.status || 'OK'}\n`);
    
    // 测试删除文件
    console.log(`清理测试文件: ${testKey}...`);
    await client.delete(testKey);
    console.log('✅ 测试文件已删除\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ OSS连接测试通过！');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error: any) {
    console.error('❌ OSS连接测试失败:');
    console.error(`   错误: ${error.message}`);
    console.error(`   错误代码: ${(error as any)?.code || 'N/A'}`);
    console.error(`   HTTP状态: ${(error as any)?.status || 'N/A'}`);
    console.error(`   请求ID: ${(error as any)?.requestId || 'N/A'}`);
    
    if (error.stack) {
      console.error(`\n   错误堆栈:\n${error.stack.substring(0, 500)}`);
    }
    
    process.exit(1);
  }
}

testOSS();
