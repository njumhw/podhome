/**
 * MuleRun Session API
 * 处理会话创建和查询历史
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOrRestoreSession, getSession } from '@/server/mulerun/session-manager';
import { verifyMulerunSignature, verifyTimestamp } from '@/server/mulerun/signature';

const MULERUN_AGENT_KEY = process.env.MULERUN_AGENT_KEY;

/**
 * GET - 获取会话信息（用于恢复会话）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      session: {
        id: session.id,
        sessionId: session.sessionId,
        status: session.status,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
      queries: session.queries.map(q => ({
        id: q.id,
        queryUrl: q.queryUrl,
        status: q.status,
        podcastId: q.podcastId,
        error: q.error,
        createdAt: q.createdAt,
        completedAt: q.completedAt,
        podcast: q.podcast ? {
          id: q.podcast.id,
          title: q.podcast.title,
          showAuthor: q.podcast.showAuthor,
          summary: q.podcast.summary,
          reportOutline: q.podcast.reportOutline,
          status: q.podcast.status,
        } : null,
      })),
    });
  } catch (error) {
    console.error('[MuleRun] 获取会话失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - 创建或恢复会话（验证签名）
 */
export async function POST(req: NextRequest) {
  try {
    if (!MULERUN_AGENT_KEY) {
      return NextResponse.json(
        { error: 'MuleRun Agent Key not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    
    // 提取所有 URL 参数
    const params: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }

    // 验证必需参数
    const { userId, sessionId, agentId, time, origin, nonce, signature } = params;
    if (!userId || !sessionId || !agentId || !time || !origin || !nonce || !signature) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 验证签名（严格按照文档）
    const isValid = verifyMulerunSignature(params, MULERUN_AGENT_KEY);
    if (!isValid) {
      console.error('[MuleRun] 签名验证失败:', { sessionId, userId, agentId });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 验证时间戳（防止重放攻击）
    const isTimeValid = verifyTimestamp(time, 300); // 允许 5 分钟时间差
    if (!isTimeValid) {
      console.error('[MuleRun] 时间戳验证失败:', { time, sessionId });
      return NextResponse.json(
        { error: 'Invalid timestamp' },
        { status: 401 }
      );
    }

    // 创建或恢复会话
    const session = await createOrRestoreSession({
      sessionId,
      userId,
      agentId,
    });

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        sessionId: session.sessionId,
        status: session.status,
        expiresAt: session.expiresAt,
      },
      queries: session.queries.map(q => ({
        id: q.id,
        queryUrl: q.queryUrl,
        status: q.status,
        podcastId: q.podcastId,
        error: q.error,
        createdAt: q.createdAt,
        completedAt: q.completedAt,
        podcast: q.podcast ? {
          id: q.podcast.id,
          title: q.podcast.title,
          showAuthor: q.podcast.showAuthor,
          summary: q.podcast.summary,
          reportOutline: q.podcast.reportOutline,
          status: q.podcast.status,
        } : null,
      })),
    });
  } catch (error) {
    console.error('[MuleRun] 创建会话失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

