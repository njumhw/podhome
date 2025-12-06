import { readFileSync } from 'fs';
import { resolve } from 'path';

// 手动加载.env文件
try {
  const envPath = resolve(__dirname, '../.env');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (error) {
  console.warn('无法加载.env文件，使用系统环境变量');
}

import { qwenTranscribeFromUrl } from '../src/clients/qwen-asr';

/**
 * 测试新的ASR模型 qwen3-asr-flash
 * 使用一个简短的测试音频URL
 */
async function testASRModel() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 测试ASR模型: qwen3-asr-flash');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 使用一个测试音频URL（你可以替换为实际的测试音频）
    // 这里使用一个公开的测试音频，或者你可以使用之前处理过的播客的一个片段
    const testAudioUrl = 'https://media.xyzcdn.net/670f3da40d2f24f28978736f/luaVbC8wX-1WxLZShoambf9-zHTY.m4a';
    
    console.log('📝 测试音频URL:', testAudioUrl);
    console.log('开始时间:', new Date().toISOString());
    console.log('');
    
    const startTime = Date.now();
    
    try {
      const result = await qwenTranscribeFromUrl(testAudioUrl, 'zh');
      
      const duration = Date.now() - startTime;
      const seconds = Math.floor(duration / 1000);
      
      console.log('\n✅ ASR转写成功！');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('📊 转写结果:');
      console.log('  语言:', result.language || '未检测');
      console.log('  文本长度:', result.text?.length || 0, '字符');
      console.log('  处理时间:', seconds, '秒');
      console.log('');
      
      if (result.text) {
        console.log('📝 转写文本预览（前200字符）:');
        console.log(result.text.substring(0, 200) + '...');
      }
      
      console.log('\n✅ 模型 qwen3-asr-flash 测试通过！');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - startTime;
      const seconds = Math.floor(duration / 1000);
      
      console.error('\n❌ ASR转写失败！');
      console.error('═══════════════════════════════════════════════════════════\n');
      console.error('错误信息:', errorMessage);
      console.error('耗时:', seconds, '秒');
      
      // 检查是否是模型不支持的错误
      if (errorMessage.includes('model') || errorMessage.includes('不支持') || errorMessage.includes('invalid')) {
        console.error('\n⚠️  可能原因：模型名称不正确或API不支持该模型');
        console.error('   建议：检查DashScope文档确认模型名称');
      }
      
      throw error;
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testASRModel();

