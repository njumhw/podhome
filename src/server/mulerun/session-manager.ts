/**
 * MuleRun 会话管理
 * 负责创建、恢复和管理 MuleRun 会话
 */

import { db } from '@/server/db';

const SESSION_TIMEOUT_MINUTES = parseInt(
  process.env.MULERUN_SESSION_TIMEOUT_MINUTES || '180'
); // 默认 3 小时

export interface MulerunSessionParams {
  sessionId: string;  // UUID, 36 chars
  userId: string;     // SHA-256, 64 chars
  agentId: string;    // UUID, 36 chars
}

/**
 * 创建或恢复 MuleRun 会话
 * 
 * @param params - 会话参数
 * @returns 会话记录
 */
export async function createOrRestoreSession(
  params: MulerunSessionParams
) {
  const { sessionId, userId, agentId } = params;

  // 计算过期时间（当前时间 + 超时时间）
  const expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000);

  // 尝试查找现有会话
  const existing = await db.mulerunSession.findUnique({
    where: { sessionId },
    include: {
      queries: {
        orderBy: { createdAt: 'desc' },
        take: 50, // 最多加载最近 50 条查询
      },
    },
  });

  if (existing) {
    // 恢复现有会话
    // 检查是否已过期
    if (new Date() > existing.expiresAt) {
      // 会话已过期，更新为新的过期时间
      return await db.mulerunSession.update({
        where: { sessionId },
        data: {
          expiresAt,
          status: 'running',
          updatedAt: new Date(),
        },
        include: {
          queries: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        },
      });
    }

    // 会话未过期，直接返回
    return existing;
  }

  // 创建新会话
  return await db.mulerunSession.create({
    data: {
      sessionId,
      userId,
      agentId,
      status: 'running',
      expiresAt,
    },
    include: {
      queries: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });
}

/**
 * 获取会话信息
 * 
 * @param sessionId - 会话 ID
 * @returns 会话记录
 */
export async function getSession(sessionId: string) {
  return await db.mulerunSession.findUnique({
    where: { sessionId },
    include: {
      queries: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });
}

/**
 * 更新会话状态
 * 
 * @param sessionId - 会话 ID
 * @param status - 新状态
 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'running' | 'completed' | 'error'
) {
  return await db.mulerunSession.update({
    where: { sessionId },
    data: {
      status,
      updatedAt: new Date(),
    },
  });
}

/**
 * 创建查询记录
 * 
 * @param sessionId - 会话 ID
 * @param queryUrl - 播客 URL
 * @returns 查询记录
 */
export async function createQuery(
  sessionId: string,
  queryUrl: string
) {
  const timeoutAt = new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60 * 1000);

  return await db.mulerunQueryHistory.create({
    data: {
      sessionId,
      queryUrl,
      status: 'pending',
      timeoutAt,
    },
  });
}

/**
 * 更新查询状态
 * 
 * @param queryId - 查询 ID
 * @param updates - 更新数据
 */
export async function updateQuery(
  queryId: string,
  updates: {
    status?: string;
    podcastId?: string;
    meteringId?: string;
    costCredits?: number;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }
) {
  return await db.mulerunQueryHistory.update({
    where: { id: queryId },
    data: {
      ...updates,
      updatedAt: new Date(),
    },
  });
}

/**
 * 获取查询记录
 * 
 * @param queryId - 查询 ID
 * @returns 查询记录
 */
export async function getQuery(queryId: string) {
  return await db.mulerunQueryHistory.findUnique({
    where: { id: queryId },
    include: {
      podcast: {
        select: {
          id: true,
          title: true,
          showAuthor: true,
          summary: true,
          reportOutline: true,
          status: true,
        },
      },
    },
  });
}

/**
 * 检查并处理超时的查询
 * 定期调用此函数来清理超时的查询
 */
export async function processTimeoutQueries() {
  const now = new Date();
  
  // 查找所有超时且仍在处理中的查询
  const timeoutQueries = await db.mulerunQueryHistory.findMany({
    where: {
      status: 'processing',
      timeoutAt: {
        lte: now,
      },
    },
  });

  for (const query of timeoutQueries) {
    console.log(`[MuleRun] 查询超时: ${query.id}, 创建时间: ${query.createdAt}`);
    
    // 更新查询状态为超时
    await db.mulerunQueryHistory.update({
      where: { id: query.id },
      data: {
        status: 'timeout',
        error: '处理超时（超过 3 小时）',
        completedAt: new Date(),
      },
    });

    // 发送 final Metering 报告（0 credits，表示失败）
    if (query.meteringId) {
      // 如果已经有 meteringId，说明已经报告过成本，不需要再报告
      console.log(`[MuleRun] 查询 ${query.id} 已有 meteringId，跳过 final 报告`);
    } else {
      // 发送 final 报告（0 credits）
      const { reportMetering } = await import('./metering');
      const finalMeteringId = `timeout-${query.id}-${Date.now()}`;
      await reportMetering(
        query.sessionId,
        finalMeteringId,
        0,
        'Query timeout after 3 hours',
        true // isFinal
      );
      
      // 更新 meteringId
      await db.mulerunQueryHistory.update({
        where: { id: query.id },
        data: {
          meteringId: finalMeteringId,
          costCredits: 0,
        },
      });
    }
  }

  return timeoutQueries.length;
}
