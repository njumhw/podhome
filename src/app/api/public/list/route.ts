import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'latest'; // latest, hot, topics
    const topic = searchParams.get('topic');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let whereClause: any = {};
    let topicId: string | null = null;
    
    if (topic) {
      // 先根据主题名称查找主题ID
      const topicRecord = await prisma.topic.findFirst({
        where: { 
          name: { contains: topic, mode: 'insensitive' },
          approved: true 
        },
        select: { id: true }
      });
      
      if (topicRecord) {
        topicId = topicRecord.id;
        whereClause.topicId = topicId;
      } else {
        // 如果找不到主题，返回空结果
        whereClause.topicId = 'nonexistent';
      }
    }

    let orderBy: any = { updatedAt: 'desc' };
    
    if (type === 'hot') {
      // 简单的热度排序：按更新时间 + 标题长度（假设更长的标题可能更受欢迎）
      orderBy = [
        { updatedAt: 'desc' },
        { title: 'asc' }
      ];
    }

    // 构建AudioCache的查询条件
    let audioCacheWhere: any = {
      // 只返回有访谈全文和标题的播客（报告可以为空）
      script: { not: null },
      title: { not: null }
    };
    
    // 如果有主题筛选，添加到AudioCache查询条件中
    if (topicId) {
      audioCacheWhere.topicId = topicId;
    }

    // 同时查询Podcast表和AudioCache表
    const [podcastItems, podcastTotal, audioCacheItems, audioCacheTotal] = await Promise.all([
      prisma.podcast.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          showAuthor: true,
          publishedAt: true,
          audioUrl: true,
          sourceUrl: true,
          summary: true,
          topic: { select: { name: true } },
          updatedAt: true
        },
        orderBy,
        skip: offset,
        take: limit
      }),
      prisma.podcast.count({ where: whereClause }),
      prisma.audioCache.findMany({
        where: audioCacheWhere,
        select: {
          id: true,
          title: true,
          author: true,
          publishedAt: true,
          audioUrl: true,
          summary: true,
          topic: { select: { name: true } },
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.audioCache.count({
        where: audioCacheWhere
      })
    ]);

    // 合并两个表的结果
    let items: any[] = [];
    let total = 0;

    // 优先使用Podcast表的数据
    if (podcastTotal > 0) {
      items = podcastItems;
      total = podcastTotal;
    } else {
      // 如果Podcast表没有数据，使用AudioCache表的数据
      items = audioCacheItems.map(item => ({
        id: item.id,
        title: item.title || '未知标题',
        showAuthor: item.author || '未知作者',
        publishedAt: item.publishedAt,
        audioUrl: item.audioUrl,
        sourceUrl: item.audioUrl, // 暂时使用audioUrl，后续会改进
        summary: item.summary,
        topic: item.topic,
        updatedAt: item.updatedAt
      }));
      total = audioCacheTotal;
    }

    return NextResponse.json({
      items: items.map(item => ({
        id: item.id,
        title: item.title,
        author: item.showAuthor,
        publishedAt: item.publishedAt,
        audioUrl: item.audioUrl,
        originalUrl: item.sourceUrl,
        summary: item.summary,
        topic: item.topic?.name || null,
        updatedAt: item.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('List error:', error);
    return NextResponse.json(
      { error: '获取列表失败' },
      { status: 500 }
    );
  }
}