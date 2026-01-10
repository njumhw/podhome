import { db } from '../src/server/db';

async function checkPodcastTranscript() {
  const podcastId = process.argv[2] || 'cmie7fjg2002glymxlejtstr0';
  
  console.log(`\n=== 检查播客 ${podcastId} 的 transcript ===\n`);
  
  // 1. 检查 Podcast 表
  console.log('1. 查询 Podcast 表:');
  const podcast = await db.podcast.findUnique({
    where: { id: podcastId },
    select: {
      id: true,
      title: true,
      originalTranscript: true,
      translatedTranscript: true,
    }
  });
  
  if (podcast) {
    console.log(`   ✅ 找到播客: ${podcast.title}`);
    console.log(`   originalTranscript 长度: ${podcast.originalTranscript?.length || 0}`);
    console.log(`   originalTranscript 是否为 null: ${podcast.originalTranscript === null}`);
    console.log(`   originalTranscript 是否为 undefined: ${podcast.originalTranscript === undefined}`);
    console.log(`   translatedTranscript 长度: ${podcast.translatedTranscript?.length || 0}`);
  } else {
    console.log('   ❌ Podcast 表中未找到');
  }
  
  // 2. 检查 AudioCache 表
  console.log('\n2. 查询 AudioCache 表:');
  const audioCache = await db.audioCache.findUnique({
    where: { id: podcastId },
    select: {
      id: true,
      title: true,
      transcript: true,
      translatedTranscript: true,
    }
  });
  
  if (audioCache) {
    console.log(`   ✅ 找到 AudioCache: ${audioCache.title}`);
    console.log(`   transcript 长度: ${audioCache.transcript?.length || 0}`);
    console.log(`   transcript 是否为 null: ${audioCache.transcript === null}`);
    console.log(`   transcript 是否为 undefined: ${audioCache.transcript === undefined}`);
    console.log(`   translatedTranscript 长度: ${audioCache.translatedTranscript?.length || 0}`);
    if (audioCache.transcript) {
      console.log(`   transcript 前100个字符: ${audioCache.transcript.substring(0, 100)}...`);
    }
  } else {
    console.log('   ❌ AudioCache 表中未找到');
  }
  
  // 3. 通过 audioUrl 查询 AudioCache
  if (podcast?.title || audioCache?.title) {
    console.log('\n3. 尝试通过 audioUrl 查询 AudioCache:');
    // 这里需要知道 audioUrl，但我们可以先检查一下
    const allAudioCache = await db.audioCache.findMany({
      where: {
        OR: [
          { id: podcastId },
          { title: { contains: podcast?.title || audioCache?.title || '' } }
        ]
      },
      select: {
        id: true,
        audioUrl: true,
        title: true,
        transcript: true,
      },
      take: 5
    });
    
    console.log(`   找到 ${allAudioCache.length} 条 AudioCache 记录:`);
    allAudioCache.forEach((ac, index) => {
      console.log(`   ${index + 1}. id=${ac.id}, title=${ac.title}, transcript长度=${ac.transcript?.length || 0}`);
    });
  }
  
  await db.$disconnect();
}

checkPodcastTranscript().catch(console.error);


