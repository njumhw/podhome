import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import { z } from "zod";

// 获取所有提示词
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const prompts = await db.prompt.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({ success: true, prompts });

  } catch (error) {
    console.error('Failed to get prompts:', error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// 创建新提示词
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      content: z.string().min(1),
      category: z.string().min(1),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const { name, description, content, category } = parsed.data;

    // 检查名称是否已存在
    const existing = await db.prompt.findUnique({
      where: { name }
    });

    if (existing) {
      return NextResponse.json({ success: false, error: "Prompt name already exists" }, { status: 400 });
    }

    const prompt = await db.prompt.create({
      data: {
        name,
        description,
        content,
        category,
        createdBy: user.id,
        updatedBy: user.id,
      }
    });

    return NextResponse.json({ success: true, prompt });

  } catch (error) {
    console.error('Failed to create prompt:', error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// 更新提示词
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const schema = z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      content: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const { id, ...updateData } = parsed.data;

    // 检查提示词是否存在
    const existing = await db.prompt.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Prompt not found" }, { status: 404 });
    }

    // 如果更新名称，检查是否与其他提示词冲突
    if (updateData.name && updateData.name !== existing.name) {
      const nameConflict = await db.prompt.findUnique({
        where: { name: updateData.name }
      });

      if (nameConflict) {
        return NextResponse.json({ success: false, error: "Prompt name already exists" }, { status: 400 });
      }
    }

    const prompt = await db.prompt.update({
      where: { id },
      data: {
        ...updateData,
        updatedBy: user.id,
        version: existing.version + 1,
      }
    });

    return NextResponse.json({ success: true, prompt });

  } catch (error) {
    console.error('Failed to update prompt:', error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// 删除提示词
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: "Prompt ID is required" }, { status: 400 });
    }

    // 检查提示词是否存在
    const existing = await db.prompt.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Prompt not found" }, { status: 404 });
    }

    await db.prompt.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Prompt deleted successfully" });

  } catch (error) {
    console.error('Failed to delete prompt:', error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

