/**
 * MuleRun Process API
 * 处理播客查询请求
 */

import { NextRequest, NextResponse } from 'next/server';
import { createQuery, getQuery, updateQuery } from '@/server/mulerun/session-manager';
import { db } from '@/server/db';
import { taskQueue } from '@/server/task-queue';
import { reportMetering } from '@/server/mulerun/metering';

const MULERUN_QUERY_COST_CREDITS = parseFloat(
  process.env.MULERUN_QUERY_COST_CREDITS || '100'
);

/**
 * POST - 提交播客处理请求
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, queryUrl } = body;

    if (!sessionId || !queryUrl) {
      return NextResponse.json(
        { error: 'Missing sessionId or queryUrl' },
        { status: 400 }
      );
    }

    // 验证会话是否存在
    const session = await db.mulerunSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // 检查会话是否过期
    if (new Date() > session.expiresAt) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 403 }
      );
    }

    // 检查是否有正在处理的查询（同一会话只能有一个并发查询）
    const processingQuery = await db.mulerunQueryHistory.findFirst({
      where: {
        sessionId: session.id,
        status: {
          in: ['pending', 'processing'],
        },
      },
    });

    if (processingQuery) {
      return NextResponse.json(
        { error: 'Another query is already processing. Please wait for it to complete.' },
        { status: 429 }
      );
    }

    // 检查播客是否已存在（直接返回已有结果）
    const existingPodcast = await db.podcast.findFirst({
      where: {
        sourceUrl: queryUrl,
        status: 'READY',
      },
      select: {
        id: true,
        title: true,
        showAuthor: true,
        summary: true,
        reportOutline: true,
        status: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (existingPodcast) {
      // 播客已存在，直接创建查询记录并返回
      const query = await createQuery(session.id, queryUrl);
      
      // 立即更新为完成状态
      await updateQuery(query.id, {
        status: 'completed',
        podcastId: existingPodcast.id,
        completedAt: new Date(),
      });

      // 报告成本（100 credits）
      const meteringId = `podcast-${query.id}-${Date.now()}`;
      const reported = await reportMetering(
        sessionId,
        meteringId,
        MULERUN_QUERY_COST_CREDITS,
        `Podcast processing: ${existingPodcast.title || queryUrl}`
      );

      if (reported) {
        await updateQuery(query.id, {
          meteringId,
          costCredits: MULERUN_QUERY_COST_CREDITS,
        });
      }

      return NextResponse.json({
        success: true,
        query: {
          id: query.id,
          status: 'completed',
          podcast: existingPodcast,
        },
        fromCache: true, // 标记为缓存结果
      });
    }

    // 播客不存在，创建查询记录并提交处理
    const query = await createQuery(session.id, queryUrl);

    // 提交到任务队列处理
    // 注意：userId 传 null，因为 MuleRun 用户不创建 User 记录
    const taskId = await taskQueue.addTask({
      type: 'PODCAST_PROCESSING',
      data: {
        url: queryUrl,
        userId: null, // MuleRun 用户不创建 User 记录
        mulerunSessionId: session.id,
        mulerunQueryId: query.id,
      },
    });

    // 更新查询状态为处理中
    await updateQuery(query.id, {
      status: 'processing',
      startedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      query: {
        id: query.id,
        status: 'processing',
        taskId,
      },
    });
  } catch (error) {
    console.error('[MuleRun] 处理请求失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - 查询处理状态
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get('queryId');

    if (!queryId) {
      return NextResponse.json(
        { error: 'Missing queryId parameter' },
        { status: 400 }
      );
    }

    const query = await getQuery(queryId);
    if (!query) {
      return NextResponse.json(
        { error: 'Query not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      query: {
        id: query.id,
        queryUrl: query.queryUrl,
        status: query.status,
        error: query.error,
        createdAt: query.createdAt,
        completedAt: query.completedAt,
        podcast: query.podcast,
      },
    });
  } catch (error) {
    console.error('[MuleRun] 查询状态失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

