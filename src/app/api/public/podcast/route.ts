import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/server/db';
import { getSessionUser } from '@/server/auth';
import { buildVisitorInfo, getVisitorUsage, recordVisitorAccess } from '@/server/visitorLimit';
import { cache, cacheKeys } from '@/utils/cache';

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
  const includeTranscript = searchParams.get('includeTranscript') === 'true'; // 是否包含transcript大字段
  
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
    // 添加查询超时，避免长时间阻塞
    let podcast: any = null;
    let resolvedFromAudioCache = false; // 提前定义，避免作用域问题
    
    // 尝试从缓存获取（只对id查询使用缓存，url查询不使用缓存）
    // 注意：如果includeTranscript=true，即使从缓存获取了数据，也需要查询大字段
    const cacheKey = id ? cacheKeys.podcast(id) : null;
    let fromCache = false;
    if (cacheKey && !includeTranscript) {
      // 只有在不需要transcript时才使用缓存（因为缓存不包含大字段）
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.log(`[api/public/podcast] 从缓存获取播客: id=${id}`);
        podcast = cached;
        fromCache = true;
      }
    }
    
    // 如果缓存未命中或需要加载transcript，查询数据库
    if (!podcast || (includeTranscript && fromCache)) {
      const dbQueryStartTime = Date.now();
      try {
        console.log(`[api/public/podcast] 开始查询播客: id=${id}, whereClause=`, JSON.stringify(whereClause));
        
        // 优化：直接不查询reportOutline字段（避免字段不存在导致的查询失败和延迟）
        // 添加查询超时保护，防止长时间阻塞（5秒超时，如果之前很快，5秒应该足够）
        const { withQueryTimeout } = await import('@/utils/query-timeout');
        
        // 优化1：使用findUnique替代findFirst（当有id时，id是主键，findUnique直接通过主键索引查找，O(1)复杂度）
        // 优化2：并行查询基本信息和topic（如果通过id查询且知道topicId，可以并行查询）
        const queryStartTime = Date.now();
        
        // 如果有id，使用findUnique（更快）；否则使用findFirst（url查询）
        const queryMethod = id 
          ? () => prisma.podcast.findUnique({
              where: { id },
              select: {
                id: true,
                title: true,
                showAuthor: true,
                publishedAt: true,
                audioUrl: true,
                sourceUrl: true,
                summary: true,
                translatedSummary: true,
                topicId: true, // 只查询topicId，不关联查询topic表
                updatedAt: true
              }
            })
          : () => prisma.podcast.findFirst({
              where: whereClause,
              select: {
                id: true,
                title: true,
                showAuthor: true,
                publishedAt: true,
                audioUrl: true,
                sourceUrl: true,
                summary: true,
                translatedSummary: true,
                topicId: true,
                updatedAt: true
              }
            });
        
        podcast = await withQueryTimeout(
          queryMethod,
          10000, // 10秒超时（第一次查询可能需要建立连接，给更多时间）
          '播客详情查询超时（基本信息）'
        );
        const queryDuration = Date.now() - queryStartTime;
        console.log(`[api/public/podcast] 基本信息查询完成: id=${id}, 耗时=${queryDuration}ms, 方法=${id ? 'findUnique' : 'findFirst'}`);
        
        // 如果找到播客，查询topic信息（优化：如果podcast有topicId，立即查询，不等待）
        if (podcast && (podcast as any).topicId) {
          try {
            const topicStartTime = Date.now();
            const topic = await withQueryTimeout(
              () => prisma.topic.findUnique({
                where: { id: (podcast as any).topicId },
                select: { name: true }
              }),
              5000, // 5秒超时
              '播客详情查询超时（topic）'
            );
            const topicDuration = Date.now() - topicStartTime;
            console.log(`[api/public/podcast] Topic查询完成: id=${id}, topicId=${(podcast as any).topicId}, 耗时=${topicDuration}ms`);
            (podcast as any).topic = topic;
          } catch (topicError: any) {
            // 如果topic查询失败，设置为null，不影响基本信息返回
            console.warn(`[api/public/podcast] Topic查询失败: id=${id}, topicId=${(podcast as any).topicId}`, topicError);
            (podcast as any).topic = null;
          }
        } else if (podcast) {
          (podcast as any).topic = null;
        }
        
        // 如果找到播客且需要加载transcript，再查询大字段
        // 优化：默认不加载大字段，只有在用户点击"看全文"时才加载（通过includeTranscript参数控制）
        if (podcast && includeTranscript) {
          try {
            let largeFields: any = null;
            
            // 根据播客来源选择不同的表查询
            if (resolvedFromAudioCache) {
              // 如果播客来自AudioCache表，检查是否已经有transcript数据
              // 注意：第一次查询AudioCache时，无论includeTranscript是true还是false，都会查询transcript字段
              // 所以如果podcast.originalTranscript已经有值，说明第一次查询时已经获取了数据
              const hasExistingData = podcast.originalTranscript !== null && podcast.originalTranscript !== undefined;
              console.log(`[api/public/podcast] AudioCache播客检查: id=${podcast.id}, originalTranscript长度=${podcast.originalTranscript?.length || 0}, translatedTranscript长度=${podcast.translatedTranscript?.length || 0}, hasExistingData=${hasExistingData}`);
              
              if (hasExistingData) {
                console.log(`[api/public/podcast] AudioCache播客已有transcript数据，无需再次查询: id=${podcast.id}`);
                // 数据已经在第一次查询时获取，不需要再次查询
              } else {
                // 如果第一次查询时没有获取到transcript（可能是数据库中的值确实是null），现在再次查询确认
                console.log(`[api/public/podcast] AudioCache播客transcript为空，尝试再次查询: id=${podcast.id}, whereClause=`, JSON.stringify(whereClause));
                largeFields = await withQueryTimeout(
                  () => prisma.audioCache.findUnique({
                    where: { id: podcast.id }, // 使用findUnique直接通过id查询，更可靠
                    select: {
                      id: true,
                      transcript: true,
                      translatedTranscript: true,
                    }
                  }),
                  15000, // 15秒超时
                  '播客详情查询超时（AudioCache大字段）'
                );
                
                if (largeFields) {
                  console.log(`[api/public/podcast] AudioCache大字段查询成功: id=${largeFields.id}, transcript长度=${largeFields.transcript?.length || 0}, translatedTranscript长度=${largeFields.translatedTranscript?.length || 0}, transcript是否为null=${largeFields.transcript === null}`);
                  // AudioCache的transcript就是originalTranscript
                  (podcast as any).originalTranscript = largeFields.transcript;
                  (podcast as any).translatedTranscript = largeFields.translatedTranscript || null;
                } else {
                  console.warn(`[api/public/podcast] AudioCache大字段查询返回null: id=${podcast.id}`);
                }
              }
            } else {
              // 如果播客来自Podcast表，查询Podcast表的大字段
              // 使用findUnique直接通过id查询，更可靠
              console.log(`[api/public/podcast] 查询Podcast表大字段: id=${podcast.id}`);
              largeFields = await withQueryTimeout(
                () => prisma.podcast.findUnique({
                  where: { id: podcast.id },
                  select: {
                    id: true,
                    transcript: true,
                    originalTranscript: true,
                    translatedTranscript: true,
                  }
                }),
                15000, // 15秒超时
                '播客详情查询超时（Podcast大字段）'
              );
              
              if (largeFields) {
                console.log(`[api/public/podcast] Podcast大字段查询成功: id=${largeFields.id}, originalTranscript长度=${largeFields.originalTranscript?.length || 0}, translatedTranscript长度=${largeFields.translatedTranscript?.length || 0}, originalTranscript是否为null=${largeFields.originalTranscript === null}`);
                (podcast as any).transcript = largeFields.transcript;
                (podcast as any).originalTranscript = largeFields.originalTranscript;
                (podcast as any).translatedTranscript = largeFields.translatedTranscript;
              } else {
                console.warn(`[api/public/podcast] Podcast大字段查询返回null: id=${podcast.id}`);
              }
            }
          } catch (largeFieldsError: any) {
            // 如果大字段查询失败，设置为null，不影响基本信息返回
            console.warn(`[api/public/podcast] 大字段查询失败，继续返回基本信息:`, largeFieldsError);
            // 对于AudioCache，可能已经有transcript数据了，不要覆盖
            if (!resolvedFromAudioCache) {
              (podcast as any).transcript = null;
              (podcast as any).originalTranscript = null;
              (podcast as any).translatedTranscript = null;
            }
          }
        } else if (podcast && !resolvedFromAudioCache) {
          // 如果不需要加载transcript，设置为null（但AudioCache已经在上面设置了，不要覆盖）
          (podcast as any).transcript = null;
          (podcast as any).originalTranscript = null;
          (podcast as any).translatedTranscript = null;
        }
        
        // 手动设置reportOutline为null（因为字段可能不存在）
        if (podcast) {
          (podcast as any).reportOutline = null;
        }
        
        const totalDbQueryDuration = Date.now() - dbQueryStartTime;
        console.log(`[api/public/podcast] 数据库查询总耗时: id=${id}, 耗时=${totalDbQueryDuration}ms`);
        
        // 如果找到播客且使用id查询，存入缓存（优化：延长缓存时间）
        // READY状态的播客数据很少变化，可以缓存5天；PROCESSING状态的播客缓存5分钟
        if (podcast && cacheKey) {
          const cacheTTL = (podcast as any).status === 'READY' 
            ? 5 * 24 * 60 * 60 * 1000  // 5天（READY状态的播客数据很少变化，几乎不会修改）
            : 5 * 60 * 1000;            // 5分钟（PROCESSING状态的播客可能还在更新）
          await cache.set(cacheKey, podcast, cacheTTL);
          console.log(`[api/public/podcast] 播客数据已缓存: id=${id}, TTL=${cacheTTL}ms (${(podcast as any).status === 'READY' ? '5天' : '5分钟'}), status=${(podcast as any).status}`);
        }
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[api/public/podcast] Podcast表查询错误:`, errorMessage);
        
        // 检查是否是数据库连接错误或超时
        if (errorMessage.includes('Can\'t reach database server') || 
            errorMessage.includes('connection pool') ||
            errorMessage.includes('P1001') ||
            errorMessage.includes('P1017') ||
            errorMessage.includes('超时') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('ETIMEDOUT')) {
          console.error(`[api/public/podcast] 数据库连接或查询超时错误:`, errorMessage);
          return NextResponse.json(
            { error: '数据库连接问题，请稍后重试' },
            { status: 503 }
          );
        }
        // 其他错误也返回503，避免500错误导致前端显示"播客不存在"
        console.error(`[api/public/podcast] 查询错误:`, errorMessage);
        return NextResponse.json(
          { error: '查询播客失败，请稍后重试' },
          { status: 503 }
        );
      }
    }

    // 如果在Podcast表没找到，查AudioCache表
    if (!podcast) {
      console.log(`[api/public/podcast] Podcast表未找到，尝试查询AudioCache表`);
      try {
        // 优化：根据includeTranscript决定是否查询大字段
        // 如果includeTranscript=false，不查询transcript字段，提升性能
        const audioCache = await prisma.audioCache.findFirst({
          where: whereClause,
          select: {
            id: true,
            title: true,
            author: true,
            audioUrl: true,
            summary: true,
            translatedSummary: true,
            ...(includeTranscript ? {
              transcript: true,
              translatedTranscript: true,
            } : {}),
            script: true,
            // report字段已删除
            publishedAt: true,
            metadata: true,
            updatedAt: true,
            topic: { select: { id: true, name: true, color: true } }
          }
        });

        if (audioCache) {
          const transcriptLength = (audioCache as any).transcript?.length || 0;
          const translatedTranscriptLength = (audioCache as any).translatedTranscript?.length || 0;
          console.log(`[api/public/podcast] AudioCache表找到播客: ${audioCache.id}, includeTranscript=${includeTranscript}, transcript长度=${transcriptLength}, translatedTranscript长度=${translatedTranscriptLength}, transcript是否为null=${(audioCache as any).transcript === null}, transcript是否为undefined=${(audioCache as any).transcript === undefined}`);
          resolvedFromAudioCache = true;
          podcast = {
            id: audioCache.id,
            title: audioCache.title || '未知标题',
            showAuthor: audioCache.author || '未知作者',
            publishedAt: audioCache.publishedAt || (audioCache.metadata as { publishedAt?: string })?.publishedAt ? new Date((audioCache.metadata as { publishedAt?: string }).publishedAt!) : null,
            audioUrl: audioCache.audioUrl,
            sourceUrl: audioCache.audioUrl,
            summary: audioCache.summary,
            translatedSummary: audioCache.translatedSummary || null,
            topic: audioCache.topic,
            transcript: null, // 清洗稿已移除
            originalTranscript: includeTranscript ? ((audioCache as any).transcript || null) : null,  // ASR原文（只有includeTranscript=true时才查询）
            translatedTranscript: includeTranscript ? ((audioCache as any).translatedTranscript || null) : null,
            reportOutline: null, // AudioCache没有reportOutline字段
            updatedAt: audioCache.updatedAt
          };
          console.log(`[api/public/podcast] 设置podcast.originalTranscript: 长度=${podcast.originalTranscript?.length || 0}, 是否为null=${podcast.originalTranscript === null}, 是否为undefined=${podcast.originalTranscript === undefined}`);
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
    
    // 调试日志：检查transcript数据
    console.log(`[api/public/podcast] 准备返回数据: id=${podcast.id}, includeTranscript=${includeTranscript}, originalTranscript长度=${podcast.originalTranscript?.length || 0}, transcript长度=${podcast.transcript?.length || 0}, transcriptToReturn长度=${transcriptToReturn?.length || 0}, resolvedFromAudioCache=${resolvedFromAudioCache}`);
    
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
      translatedSummary: (!user && !isMulerunRequest && visitorLimitExceeded) ? null : ((podcast as any).translatedSummary || null), // 中文翻译总结（只有 Visitor 权限受限时不返回）
      topic: podcast.topic,
      script: null, // 清洗稿已移除，始终为null
      originalTranscript: transcriptToReturn, // ASR原文（如果权限受限，只返回前10行）
      translatedTranscript: (!user && !isMulerunRequest && visitorLimitExceeded) ? null : ((podcast as any).translatedTranscript || null), // 中文翻译原文（只有 Visitor 权限受限时不返回）
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
