import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { parseXiaoyuzhouEpisode } from "@/server/parsers/xiaoyuzhou";

export async function POST(req: NextRequest) {
  try {
    // 检查管理员权限
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { podcastId } = await req.json();
    
    if (!podcastId) {
      return NextResponse.json({ success: false, error: "Podcast ID is required" }, { status: 400 });
    }

    // 获取播客信息
    const podcast = await db.audioCache.findUnique({
      where: { id: podcastId },
      select: {
        id: true,
        title: true,
        originalUrl: true,
        author: true,
        publishedAt: true
      }
    });

    if (!podcast) {
      return NextResponse.json({ success: false, error: "Podcast not found" }, { status: 404 });
    }

    if (!podcast.originalUrl) {
      return NextResponse.json({ success: false, error: "No original URL found" }, { status: 400 });
    }

    console.log(`正在重新解析播客: ${podcast.title}`);
    console.log(`URL: ${podcast.originalUrl}`);

    // 重新解析播客元数据
    const meta = await parseXiaoyuzhouEpisode(podcast.originalUrl);
    
    console.log(`解析结果:`, {
      author: meta.author,
      publishedAt: meta.publishedAt,
      podcastTitle: meta.podcastTitle
    });

    // 准备更新数据
    const updateData: any = {};
    if (meta.author) updateData.author = meta.author;
    if (meta.publishedAt) updateData.publishedAt = new Date(meta.publishedAt);
    if (meta.podcastTitle && !meta.author) updateData.author = meta.podcastTitle;

    if (Object.keys(updateData).length > 0) {
      // 更新数据库
      await db.audioCache.update({
        where: { id: podcastId },
        data: updateData
      });

      console.log(`✅ 更新成功: ${JSON.stringify(updateData)}`);

      return NextResponse.json({ 
        success: true, 
        message: "Podcast metadata updated successfully",
        updatedFields: updateData
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: "No metadata found to update" 
      });
    }

  } catch (error) {
    console.error('Failed to update podcast metadata:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 });
  }
}
