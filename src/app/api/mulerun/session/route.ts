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

    // 获取 Agent Key（优先使用环境变量，本地测试时可以从 localStorage 传递）
    // 注意：在生产环境中，应该只使用环境变量
    // 清理 Agent Key（移除首尾空格和引号）
    let agentKey = MULERUN_AGENT_KEY?.trim().replace(/^["']|["']$/g, '') || '';
    
    // 本地开发时，如果环境变量未加载，尝试从请求中获取（仅用于测试）
    if (!agentKey && process.env.NODE_ENV === 'development') {
      // 从请求头或查询参数中获取（测试用）
      const testAgentKey = req.headers.get('x-test-agent-key') || searchParams.get('_test_agent_key');
      if (testAgentKey) {
        agentKey = testAgentKey;
        console.warn('[MuleRun] 使用测试 Agent Key（仅开发模式）');
      }
    }

    if (!agentKey) {
      return NextResponse.json(
        { error: 'MuleRun Agent Key not configured. Please restart the development server after adding MULERUN_AGENT_KEY to .env file.' },
        { status: 500 }
      );
    }

    // 验证签名（严格按照文档）
    console.log('[MuleRun] 开始签名验证:', {
      sessionId,
      userId: userId?.substring(0, 10) + '...',
      agentId,
      hasSignature: !!signature,
      paramKeys: Object.keys(params),
      agentKeyPrefix: agentKey ? `${agentKey.substring(0, 10)}...` : 'undefined',
      agentKeyLength: agentKey?.length,
      agentKeyEnd: agentKey ? `...${agentKey.substring(agentKey.length - 10)}` : 'undefined',
    });
    
    const isValid = verifyMulerunSignature(params, agentKey);
    if (!isValid) {
      console.error('[MuleRun] 签名验证失败:', { 
        sessionId, 
        userId: userId?.substring(0, 10) + '...', 
        agentId,
        receivedParams: Object.keys(params),
        agentKeyPrefix: agentKey ? `${agentKey.substring(0, 10)}...` : 'undefined',
        // 输出接收到的参数值（部分，用于调试）
        paramValues: {
          userId: userId?.substring(0, 10) + '...',
          sessionId: sessionId?.substring(0, 10) + '...',
          agentId: agentId?.substring(0, 10) + '...',
          time: time,
          origin: origin,
          nonce: nonce?.substring(0, 10) + '...',
          signature: signature?.substring(0, 20) + '...',
        },
      });
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

