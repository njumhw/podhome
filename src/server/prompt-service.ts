import { db } from "@/server/db";

// 提示词缓存
const promptCache = new Map<string, { content: string; version: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取提示词内容
 * @param name 提示词名称
 * @returns 提示词内容
 */
export async function getPrompt(name: string): Promise<string> {
  try {
    // 检查缓存
    const cached = promptCache.get(name);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.content;
    }

    // 从数据库获取
    const prompt = await db.prompt.findUnique({
      where: { 
        name,
        isActive: true
      }
    });

    if (!prompt) {
      throw new Error(`Prompt "${name}" not found`);
    }

    // 更新缓存
    promptCache.set(name, {
      content: prompt.content,
      version: prompt.version,
      timestamp: Date.now()
    });

    return prompt.content;

  } catch (error) {
    console.error(`Failed to get prompt "${name}":`, error);
    throw error;
  }
}

/**
 * 清除提示词缓存
 * @param name 提示词名称，如果不提供则清除所有缓存
 */
export function clearPromptCache(name?: string): void {
  if (name) {
    promptCache.delete(name);
  } else {
    promptCache.clear();
  }
}

/**
 * 获取所有提示词信息（用于管理界面）
 */
export async function getAllPrompts() {
  return await db.prompt.findMany({
    orderBy: [
      { category: 'asc' },
      { name: 'asc' }
    ]
  });
}

/**
 * 创建提示词
 */
export async function createPrompt(data: {
  name: string;
  description?: string;
  content: string;
  category: string;
  createdBy?: string;
}) {
  return await db.prompt.create({
    data: {
      ...data,
      version: 1,
    }
  });
}

/**
 * 更新提示词
 */
export async function updatePrompt(id: string, data: {
  name?: string;
  description?: string;
  content?: string;
  category?: string;
  isActive?: boolean;
  updatedBy?: string;
}) {
  const existing = await db.prompt.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Prompt not found");
  }

  const result = await db.prompt.update({
    where: { id },
    data: {
      ...data,
      version: existing.version + 1,
    }
  });

  // 清除相关缓存
  clearPromptCache(existing.name);
  if (data.name && data.name !== existing.name) {
    clearPromptCache(data.name);
  }

  return result;
}

/**
 * 删除提示词
 */
export async function deletePrompt(id: string) {
  const existing = await db.prompt.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Prompt not found");
  }

  await db.prompt.delete({ where: { id } });
  
  // 清除缓存
  clearPromptCache(existing.name);
}
