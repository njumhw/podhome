import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

// 根据名称获取提示词（用于后端服务）
export async function GET(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const { name } = params;

    const prompt = await db.prompt.findUnique({
      where: { 
        name,
        isActive: true
      }
    });

    if (!prompt) {
      return NextResponse.json({ 
        success: false, 
        error: "Prompt not found" 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      prompt: {
        name: prompt.name,
        content: prompt.content,
        category: prompt.category,
        version: prompt.version
      }
    });

  } catch (error) {
    console.error('Failed to get prompt:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal Server Error" 
    }, { status: 500 });
  }
}
