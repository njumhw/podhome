import { parseXiaoyuzhouEpisode } from './src/server/parsers/xiaoyuzhou.ts';

async function testParser() {
  try {
    const result = await parseXiaoyuzhouEpisode('https://www.xiaoyuzhoufm.com/episode/68bfcb8f271ba1b113050059');
    console.log('解析结果:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('解析错误:', error);
  }
}

testParser();
