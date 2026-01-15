import { normalizePodcastUrl } from '../src/utils/url-normalizer';

const testUrls = [
  'https://www.xiaoyuzhoufm.com/episode/695a67c3b9fb626141018acd?s=eyJ1IjoiNjVkNWM3YjZlZGNlNjcxMDRhNWI4ZmQ1In0%3D',
  'https://www.xiaoyuzhoufm.com/episode/695a67c3b9fb626141018acd',
  'https://www.xiaoyuzhoufm.com/episode/695a67c3b9fb626141018acd?other=param',
  'https://podcasts.apple.com/us/podcast/test?id=123',
];

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 测试URL标准化功能');
console.log('═══════════════════════════════════════════════════════════\n');

testUrls.forEach((url, index) => {
  const normalized = normalizePodcastUrl(url);
  const isChanged = normalized !== url;
  console.log(`测试 ${index + 1}:`);
  console.log(`  原始URL: ${url}`);
  console.log(`  标准化后: ${normalized}`);
  console.log(`  是否改变: ${isChanged ? '✅ 是' : '❌ 否'}`);
  console.log('');
});

// 测试相同内容的URL是否被标准化为同一个
const url1 = 'https://www.xiaoyuzhoufm.com/episode/695a67c3b9fb626141018acd?s=eyJ1IjoiNjVkNWM3YjZlZGNlNjcxMDRhNWI4ZmQ1In0%3D';
const url2 = 'https://www.xiaoyuzhoufm.com/episode/695a67c3b9fb626141018acd';
const normalized1 = normalizePodcastUrl(url1);
const normalized2 = normalizePodcastUrl(url2);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('关键测试：相同内容的URL是否标准化为同一个');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`URL 1 (带查询参数): ${url1}`);
console.log(`标准化后: ${normalized1}\n`);
console.log(`URL 2 (不带查询参数): ${url2}`);
console.log(`标准化后: ${normalized2}\n`);

if (normalized1 === normalized2) {
  console.log('✅ 测试通过：两个URL被标准化为同一个！');
} else {
  console.log('❌ 测试失败：两个URL标准化后仍然不同！');
}

console.log('\n═══════════════════════════════════════════════════════════');
