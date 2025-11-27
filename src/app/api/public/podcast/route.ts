import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';
import { getSessionUser } from '@/server/auth';
import { buildVisitorInfo, getVisitorUsage, recordVisitorAccess } from '@/server/visitorLimit';

// 获取客户端 IP 地址
function getClientIp(req: NextRequest): string {
	const forwarded = req.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	const realIp = req.headers.get('x-real-ip');
	if (realIp) {
		return realIp;
	}
	// NextRequest 没有 ip 属性，使用 'unknown' 作为默认值
	return 'unknown';
}

// 获取 User-Agent
function getUserAgent(req: NextRequest): string {
	return req.headers.get('user-agent') || 'unknown';
}

export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const userAgent = getUserAgent(request);

    // 尝试获取用户（可能为 null，表示 Visitor）
    let user = null;
    try {
      user = await getSessionUser();
    } catch (error) {
      console.warn('[VisitorLimit] getSessionUser failed, fallback to visitor mode:', error);
    }

    let visitorUsage = null;
    if (!user) {
      visitorUsage = await getVisitorUsage(clientIp, userAgent);
      if (!visitorUsage.allowed) {
        return NextResponse.json(
          {
            error: 'VISITOR_LIMIT_EXCEEDED',
            message: '今日查看次数已用完，请注册登录后无限浏览',
            count: visitorUsage.count,
            limit: visitorUsage.limit,
          },
          { status: 403 }
        );
      }
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const url = searchParams.get('url');
    
    if (!id && !url) {
      return NextResponse.json(
        { error: '需要提供id或url参数' },
        { status: 400 }
      );
    }

    let whereClause: { id?: string; OR?: Array<{ sourceUrl?: string; audioUrl?: string }> } = {};
    
    if (id) {
      whereClause.id = id;
    } else if (url) {
      whereClause.OR = [
        { sourceUrl: url },
        { audioUrl: url }
      ];
    }

    // 先查Podcast表
    // 注意：reportOutline字段可能还不存在（如果迁移未执行），使用findMany+select来避免字段不存在错误
    let podcast: any = null;
    try {
      podcast = await prisma.podcast.findFirst({
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
          transcript: true,
          originalTranscript: true, // 添加ASR原文字段
          reportOutline: true, // 报告大纲（如果字段存在）
          updatedAt: true
        }
      });
    } catch (error: any) {
      // 如果reportOutline字段不存在，尝试不查询该字段
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('reportOutline') || errorMessage.includes('Unknown column')) {
        console.warn('reportOutline字段不存在，使用兼容查询');
        podcast = await prisma.podcast.findFirst({
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
            transcript: true,
            originalTranscript: true,
            updatedAt: true
          }
        });
        // 手动设置reportOutline为null
        if (podcast) {
          podcast.reportOutline = null;
        }
      } else {
        throw error; // 其他错误继续抛出
      }
    }

    let resolvedFromAudioCache = false;
    // 如果在Podcast表没找到，查AudioCache表
    if (!podcast) {
      const audioCache = await prisma.audioCache.findFirst({
        where: whereClause,
        select: {
          id: true,
          title: true,
          author: true,
          audioUrl: true,
          summary: true,
          transcript: true,
          script: true,
          // report字段已删除
          publishedAt: true,
          metadata: true,
          updatedAt: true,
          topic: { select: { id: true, name: true, color: true } }
        }
      });

      if (audioCache) {
        resolvedFromAudioCache = true;
        podcast = {
          id: audioCache.id,
          title: audioCache.title || '未知标题',
          showAuthor: audioCache.author || '未知作者',
          publishedAt: audioCache.publishedAt || (audioCache.metadata as { publishedAt?: string })?.publishedAt ? new Date((audioCache.metadata as { publishedAt?: string }).publishedAt!) : null,
          audioUrl: audioCache.audioUrl,
          sourceUrl: audioCache.audioUrl,
          summary: audioCache.summary,
          topic: audioCache.topic,
          transcript: null, // 清洗稿已移除
          originalTranscript: audioCache.transcript,  // ASR原文
          reportOutline: null, // AudioCache没有reportOutline字段
          updatedAt: audioCache.updatedAt
        };
      }
    }

    if (!podcast) {
      return NextResponse.json(
        { error: '播客不存在' },
        { status: 404 }
      );
    }

    // 获取点赞数
    const likeCount = await prisma.podcastLike.count({
      where: { podcastId: podcast.id }
    });

    await recordVisitorAccess({
      podcastId: resolvedFromAudioCache ? null : podcast.id,
      audioCacheId: resolvedFromAudioCache ? podcast.id : null,
      userId: user?.id ?? null,
      userIp: user ? null : clientIp,
      userAgent: user ? null : userAgent,
    });

    // 如果是 Visitor，返回剩余次数信息
    const responseData: any = {
      id: podcast.id,
      title: podcast.title,
      author: podcast.showAuthor,
      publishedAt: podcast.publishedAt,
      audioUrl: podcast.audioUrl,
      originalUrl: podcast.sourceUrl,
      summary: podcast.summary,
      topic: podcast.topic,
      script: null, // 清洗稿已移除，始终为null
      originalTranscript: podcast.originalTranscript || podcast.transcript, // ASR原文（优先使用originalTranscript，fallback到transcript以兼容旧数据）
      reportOutline: (podcast as any).reportOutline || null, // 报告大纲
      report: podcast.summary,
      updatedAt: podcast.updatedAt,
      likeCount
    };

    if (!user && visitorUsage) {
      responseData.visitorInfo = buildVisitorInfo(visitorUsage);
    }

    const response = NextResponse.json(responseData);
    
    // 细粒度缓存：短期缓存10秒，缓解瞬时高并发
    response.headers.set('Cache-Control', 'public, max-age=10, s-maxage=10, stale-while-revalidate=30');
    
    return response;
  } catch (error) {
    console.error('Podcast fetch error:', error);
    
    // 检查是否是数据库连接问题
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Can\'t reach database server') || 
        errorMessage.includes('connection pool')) {
      return NextResponse.json(
        { error: '数据库连接问题，请稍后重试' },
        { status: 503 } // Service Unavailable
      );
    }
    
    const debugPayload = process.env.NODE_ENV !== 'production' ? { details: errorMessage } : {};
    return NextResponse.json(
      { error: '获取播客详情失败', ...debugPayload },
      { status: 500 }
    );
  }
}
