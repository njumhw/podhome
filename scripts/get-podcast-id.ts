import { db as prisma } from '@/server/db';

async function getPodcastId() {
  const podcast = await prisma.podcast.findFirst({
    where: { status: 'READY' },
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
  });
  
  if (podcast) {
    console.log(`找到播客: ${podcast.title}`);
    console.log(`ID: ${podcast.id}`);
    return podcast.id;
  }
  
  const audioCache = await prisma.audioCache.findFirst({
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
  });
  
  if (audioCache) {
    console.log(`找到播客: ${audioCache.title}`);
    console.log(`ID: ${audioCache.id}`);
    return audioCache.id;
  }
  
  console.log('未找到播客');
  return null;
}

getPodcastId()
  .then(id => {
    if (id) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());


