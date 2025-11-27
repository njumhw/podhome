/**
 * 自动标注播客主题的API端点
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth';
import { batchAutoTagPodcasts, autoTagPodcast } from '@/server/topic-auto-tagger';
import { db } from '@/server/db';
import { UserRole } from '@prisma/client';

/**
 * POST /api/podcast/auto-tag
 * 批量自动标注播客主题
 * 
 * Body:
 * - podcastIds?: string[] - 要标注的播客ID数组，如果为空则处理所有未标注的播客
 * - dryRun?: boolean - 是否只是预览，不实际更新数据库（默认false）
 */
export async function POST(req: NextRequest) {
  try {
    // 需要管理员权限
    const user = await requireUser();
    if (user.role !== UserRole.ADMIN) {
      return Response.json({ error: '需要管理员权限' }, { status: 403 });
    }
    
    const body = await req.json().catch(() => ({}));
    const { podcastIds, dryRun = false } = body;
    
    const result = await batchAutoTagPodcasts(podcastIds, dryRun);
    
    return Response.json({
      success: true,
      ...result,
      message: dryRun 
        ? `预览完成：共 ${result.total} 个播客，可标注 ${result.tagged} 个，跳过 ${result.skipped} 个`
        : `标注完成：共 ${result.total} 个播客，已标注 ${result.tagged} 个，跳过 ${result.skipped} 个`,
    });
  } catch (error) {
    console.error('自动标注失败:', error);
    return Response.json(
      { error: '自动标注失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/podcast/auto-tag?podcastId=xxx
 * 为单个播客预览自动标注结果
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== UserRole.ADMIN) {
      return Response.json({ error: '需要管理员权限' }, { status: 403 });
    }
    
    const { searchParams } = new URL(req.url);
    const podcastId = searchParams.get('podcastId');
    
    if (!podcastId) {
      return Response.json({ error: '缺少 podcastId 参数' }, { status: 400 });
    }
    
    const podcast = await db.podcast.findUnique({
      where: { id: podcastId },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        description: true,
        showAuthor: true,
        summary: true,
        originalTranscript: true,
      },
    });
    
    if (!podcast) {
      return Response.json({ error: '播客不存在' }, { status: 404 });
    }
    
    const topicName = await autoTagPodcast(podcast);
    
    return Response.json({
      success: true,
      podcastId: podcast.id,
      title: podcast.title,
      suggestedTopic: topicName,
    });
  } catch (error) {
    console.error('预览自动标注失败:', error);
    return Response.json(
      { error: '预览失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


