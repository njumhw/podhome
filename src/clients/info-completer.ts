import { qwenChat, ChatMessage } from './qwen-text';

export interface InfoCompleterResult {
  content: string; // A3
  coverageRate?: number; // 模型自检输出（可选）
}

/**
 * 基于A1(原文) + A2(清洗稿) 的信息补全，产出A3(信息更完整的清洗稿)
 * 约束：只允许使用A1中的信息进行补全，不引入外部信息；尽量保持A2结构。
 */
export async function completeInfoA1A2(
  a1: string,
  a2: string,
  options?: { model?: string; maxTokens?: number }
): Promise<InfoCompleterResult> {
  // 提示词：一步完成（内部可让模型先列missing后直接给出补全结果），ROI友好
  const systemPrompt = `你是访谈清洗补全编辑。现在有两份文本：\n- A1：ASR原文（信息完整但口语化）\n- A2：清洗后稿（可能遗漏信息）\n\n任务：仅基于A1，对A2进行信息补全，生成A3。\n严格限制：\n- 仅使用A1中的信息进行补全，**不得引入A1之外的任何信息或推测**。\n- 尽量保持A2的段落与角色结构，在恰当位置自然融入缺失要点，可做少量措辞调整以保证连贯。\n- 目标是“信息完整性优先”，语言清楚不啰嗦。\n输出：仅输出最终A3全文，不要解释。`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请基于A1补全A2。\n\n【A1】\n${a1}\n\n【A2】\n${a2}\n\n请输出A3：` },
  ];

  const content = await qwenChat(messages, {
    model: options?.model,
    maxTokens: options?.maxTokens ?? 32000,
    temperature: 0.1,
  });

  return { content };
}

/**
 * 带一次自检的补全：若模型估计覆盖率<90%，允许再补全一次（不再自检）。
 */
export async function completeInfoWithCheck(
  a1: string,
  a2: string,
  options?: { model?: string; maxTokens?: number }
): Promise<InfoCompleterResult> {
  const first = await completeInfoA1A2(a1, a2, options);

  // 简单启发式：长度相对A1过短时，触发一次再补全（避免循环）。
  const rate = first.content && a1 ? first.content.length / a1.length : 0;
  if (rate < 0.9) {
    const second = await completeInfoA1A2(a1, first.content, options);
    return { content: second.content };
  }

  return first;
}



