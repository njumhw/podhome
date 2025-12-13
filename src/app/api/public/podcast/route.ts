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
  // 提前获取 id，以便在 catch 块中使用
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  try {
    const clientIp = getClientIp(request);
    const userAgent = getUserAgent(request);

    // 检查是否是 MuleRun 用户请求（通过 Referer 或 URL 参数判断）
    const referer = request.headers.get('referer') || '';
    const isMulerunFromReferer = referer.includes('/mulerun/');
    const isMulerunFromParam = searchParams.get('_mulerun') === 'true';
    const isMulerunRequest = isMulerunFromReferer || isMulerunFromParam;
    
    if (isMulerunRequest) {
      console.log(`[api/public/podcast] 检测到 MuleRun 用户请求: referer=${referer}, param=${isMulerunFromParam}`);
    }

    // 尝试获取用户（可能为 null，表示 Visitor）
    let user = null;
    try {
      user = await getSessionUser();
      if (user) {
        console.log(`[api/public/podcast] 用户已登录: id=${user.id}, role=${user.role}, email=${user.email}`);
      }
    } catch (error) {
      // 只有真正的认证错误才认为是 Visitor
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[api/public/podcast] getSessionUser failed (用户未登录或认证失败): ${errorMsg}`);
      // 不设置 user，继续作为 Visitor 处理
    }

    let visitorUsage = null;
    let visitorLimitExceeded = false;
    // MuleRun 用户和已登录用户都不应该被限制
    // 只有真正的 Visitor（未登录用户且不是 MuleRun 请求）才检查限制
    if (!user && !isMulerunRequest) {
      console.log(`[api/public/podcast] 检测到 Visitor 访问，检查访问限制: ip=${clientIp}`);
      visitorUsage = await getVisitorUsage(clientIp, userAgent);
      if (!visitorUsage.allowed) {
        console.log(`[api/public/podcast] Visitor 访问限制已用完: count=${visitorUsage.count}, limit=${visitorUsage.limit}`);
        // 不再直接返回403，而是标记为受限，继续查询播客信息
        visitorLimitExceeded = true;
      } else {
        console.log(`[api/public/podcast] Visitor 访问允许: count=${visitorUsage.count}, limit=${visitorUsage.limit}`);
      }
    } else if (isMulerunRequest) {
      console.log(`[api/public/podcast] MuleRun 用户访问，跳过 Visitor 限制检查`);
    } else if (user) {
      console.log(`[api/public/podcast] 已登录用户访问，跳过 Visitor 限制检查: role=${user.role}`);
    }
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
      console.log(`[api/public/podcast] 查询播客: id=${id}, whereClause=`, JSON.stringify(whereClause));
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
      console.log(`[api/public/podcast] Podcast表查询结果: ${podcast ? '找到' : '未找到'}`);
    } catch (error: any) {
      // 如果reportOutline字段不存在，尝试不查询该字段
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[api/public/podcast] Podcast表查询错误:`, errorMessage);
      
      if (errorMessage.includes('reportOutline') || errorMessage.includes('Unknown column')) {
        console.warn('reportOutline字段不存在，使用兼容查询');
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
              originalTranscript: true,
              updatedAt: true
            }
          });
          // 手动设置reportOutline为null
          if (podcast) {
            podcast.reportOutline = null;
          }
        } catch (retryError: any) {
          console.error(`[api/public/podcast] 兼容查询也失败:`, retryError);
          throw retryError; // 重新抛出错误
        }
      } else {
        // 检查是否是数据库连接错误
        if (errorMessage.includes('Can\'t reach database server') || 
            errorMessage.includes('connection pool') ||
            errorMessage.includes('P1001') ||
            errorMessage.includes('P1017')) {
          console.error(`[api/public/podcast] 数据库连接错误:`, errorMessage);
          return NextResponse.json(
            { error: '数据库连接问题，请稍后重试' },
            { status: 503 }
          );
        }
        throw error; // 其他错误继续抛出
      }
    }

    let resolvedFromAudioCache = false;
    // 如果在Podcast表没找到，查AudioCache表
    if (!podcast) {
      console.log(`[api/public/podcast] Podcast表未找到，尝试查询AudioCache表`);
      try {
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
          console.log(`[api/public/podcast] AudioCache表找到播客: ${audioCache.id}`);
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
        } else {
          console.log(`[api/public/podcast] AudioCache表也未找到播客`);
        }
      } catch (audioCacheError: any) {
        const errorMessage = audioCacheError instanceof Error ? audioCacheError.message : String(audioCacheError);
        console.error(`[api/public/podcast] AudioCache表查询错误:`, errorMessage);
        
        // 检查是否是数据库连接错误
        if (errorMessage.includes('Can\'t reach database server') || 
            errorMessage.includes('connection pool') ||
            errorMessage.includes('P1001') ||
            errorMessage.includes('P1017')) {
          return NextResponse.json(
            { error: '数据库连接问题，请稍后重试' },
            { status: 503 }
          );
        }
        // 其他错误继续抛出，会被外层catch捕获
        throw audioCacheError;
      }
    }

    if (!podcast) {
      console.log(`[api/public/podcast] 播客不存在: id=${id}`);
      return NextResponse.json(
        { error: '播客不存在', id: id },
        { status: 404 }
      );
    }
    
    console.log(`[api/public/podcast] 成功找到播客: id=${podcast.id}, title=${podcast.title}`);

    // 获取点赞数
    const likeCount = await prisma.podcastLike.count({
      where: { podcastId: podcast.id }
    });

    // 只有在权限未用完时才记录访问（避免重复计数）
    // 如果权限已用完，说明之前已经记录过了，不再重复记录
    // MuleRun 用户不记录访问（因为他们已经通过签名验证，有无限访问权限）
    if (!visitorLimitExceeded && !isMulerunRequest) {
      await recordVisitorAccess({
        podcastId: resolvedFromAudioCache ? null : podcast.id,
        audioCacheId: resolvedFromAudioCache ? podcast.id : null,
        userId: user?.id ?? null,
        userIp: user ? null : clientIp,
        userAgent: user ? null : userAgent,
      });
    }

    // 如果是 Visitor 且权限已用完，只返回前10行内容
    // 注意：只有真正的 Visitor（未登录用户且不是 MuleRun 请求）才会被限制
    // 已登录用户和 MuleRun 用户都不应该被限制
    let summaryToReturn = podcast.summary;
    let transcriptToReturn = podcast.originalTranscript || podcast.transcript;
    
    // 只有 Visitor 且权限已用完时才限制内容
    if (!user && !isMulerunRequest && visitorLimitExceeded) {
      console.log(`[api/public/podcast] Visitor 权限已用完，返回受限内容`);
      // 截取摘要的前10行
      if (summaryToReturn) {
        const summaryLines = summaryToReturn.split('\n');
        const previewLines = summaryLines.slice(0, 10);
        summaryToReturn = previewLines.join('\n');
      }
      
      // 截取转录稿的前10行
      if (transcriptToReturn) {
        const transcriptLines = transcriptToReturn.split('\n');
        const previewLines = transcriptLines.slice(0, 10);
        transcriptToReturn = previewLines.join('\n');
      }
    } else if (isMulerunRequest) {
      console.log(`[api/public/podcast] MuleRun 用户访问，返回完整内容`);
    } else if (user) {
      console.log(`[api/public/podcast] 已登录用户访问，返回完整内容: role=${user.role}`);
    }

    // 如果是 Visitor，返回剩余次数信息
    const responseData: any = {
      id: podcast.id,
      title: podcast.title,
      author: podcast.showAuthor,
      publishedAt: podcast.publishedAt,
      audioUrl: podcast.audioUrl,
      originalUrl: podcast.sourceUrl,
      summary: summaryToReturn,
      topic: podcast.topic,
      script: null, // 清洗稿已移除，始终为null
      originalTranscript: transcriptToReturn, // ASR原文（如果权限受限，只返回前10行）
      reportOutline: (!user && !isMulerunRequest && visitorLimitExceeded) ? null : ((podcast as any).reportOutline || null), // 报告大纲（只有 Visitor 权限受限时不返回）
      report: summaryToReturn,
      updatedAt: podcast.updatedAt,
      likeCount,
      // 标记是否受限（只有 Visitor 且权限已用完时才为 true）
      isLimited: !user && !isMulerunRequest && visitorLimitExceeded,
      visitorLimitExceeded: !user && !isMulerunRequest && visitorLimitExceeded
    };

    // 返回访客信息（包括权限用完的情况，MuleRun 用户不需要）
    if (!user && !isMulerunRequest) {
      if (visitorLimitExceeded && visitorUsage) {
        // 权限已用完，返回受限信息
        responseData.visitorInfo = {
          used: visitorUsage.count,
          total: visitorUsage.limit,
          remaining: 0,
          limitExceeded: true
        };
      } else if (visitorUsage) {
        // 权限未用完，返回正常信息
        responseData.visitorInfo = buildVisitorInfo(visitorUsage);
      }
    }

    const response = NextResponse.json(responseData);
    
    // 细粒度缓存：短期缓存10秒，缓解瞬时高并发
    response.headers.set('Cache-Control', 'public, max-age=10, s-maxage=10, stale-while-revalidate=30');
    
    return response;
  } catch (error) {
    console.error('[api/public/podcast] 错误详情:', error);
    
    // 检查是否是数据库连接问题
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as any)?.code;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    console.error(`[api/public/podcast] 错误类型: ${errorName}, 错误代码: ${errorCode}, 错误信息: ${errorMessage}`);
    
    // 数据库连接相关错误
    if (errorMessage.includes('Can\'t reach database server') || 
        errorMessage.includes('connection pool') ||
        errorMessage.includes('P1001') || // Prisma 连接错误
        errorMessage.includes('P1017') || // Prisma 服务器关闭连接
        errorMessage.includes('P1002') || // Prisma 连接超时
        errorCode === 'P1001' ||
        errorCode === 'P1017' ||
        errorCode === 'P1002') {
      console.error('[api/public/podcast] 数据库连接问题，返回503');
      return NextResponse.json(
        { error: '数据库连接问题，请稍后重试', id: id || null },
        { status: 503 } // Service Unavailable
      );
    }
    
    // Prisma 查询错误
    if (errorName === 'PrismaClientKnownRequestError' ||
        errorName === 'PrismaClientInitializationError' ||
        errorName === 'PrismaClientRustPanicError') {
      console.error('[api/public/podcast] Prisma 错误，返回503');
      return NextResponse.json(
        { error: '数据库查询失败，请稍后重试', id: id || null },
        { status: 503 }
      );
    }
    
    const debugPayload = process.env.NODE_ENV !== 'production' ? { 
      details: errorMessage,
      errorCode,
      errorName,
      id: id || null
    } : { id: id || null };
    
    return NextResponse.json(
      { error: '获取播客详情失败', ...debugPayload },
      { status: 500 }
    );
  }
}
