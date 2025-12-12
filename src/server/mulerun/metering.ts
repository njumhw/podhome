/**
 * MuleRun Metering API 集成（严格按照官方文档实现）
 * 参考：https://mulerun.com/docs/creator-guide/agent/iframe-agent-spec#metering-apis
 */

const MULERUN_API_BASE_URL = process.env.MULERUN_API_BASE_URL || 'https://api.mulerun.com';
const MULERUN_AGENT_KEY = process.env.MULERUN_AGENT_KEY;

if (!MULERUN_AGENT_KEY) {
  console.warn('[MuleRun] MULERUN_AGENT_KEY 未配置，Metering API 将无法使用');
}

/**
 * 报告使用成本到 MuleRun
 * 
 * 文档要求：
 * - Endpoint: POST https://api.mulerun.com/sessions/metering
 * - Authorization: Bearer {agent_key}
 * - 支持幂等性（通过 meteringId）
 * - 可以标记为 final 来终止会话
 * 
 * @param sessionId - MuleRun 会话 ID
 * @param meteringId - 幂等 ID（必须唯一）
 * @param credits - 成本（credits，100 credits = 0.01）
 * @param description - 描述（可选）
 * @param isFinal - 是否为最终报告（终止会话）
 * @returns 是否成功
 */
export async function reportMetering(
  sessionId: string,
  meteringId: string,
  credits: number,
  description?: string,
  isFinal: boolean = false
): Promise<boolean> {
  if (!MULERUN_AGENT_KEY) {
    console.error('[MuleRun] Metering API 失败: MULERUN_AGENT_KEY 未配置');
    return false;
  }

  try {
    const url = `${MULERUN_API_BASE_URL}/sessions/metering`;
    
    const body: any = {
      sessionId,
      meteringId,
      credits,
    };

    if (description) {
      body.description = description;
    }

    if (isFinal) {
      body.isFinal = true;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MULERUN_AGENT_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MuleRun] Metering API 失败: HTTP ${response.status}`, errorText);
      return false;
    }

    console.log(`[MuleRun] Metering 报告成功: sessionId=${sessionId}, meteringId=${meteringId}, credits=${credits}`);
    return true;
  } catch (error) {
    console.error('[MuleRun] Metering API 异常:', error);
    return false;
  }
}

/**
 * 查询会话的 Metering 状态
 * 
 * 文档要求：
 * - Endpoint: GET https://api.mulerun.com/sessions/metering/{sessionId}
 * - Authorization: Bearer {agent_key}
 * 
 * @param sessionId - MuleRun 会话 ID
 * @returns Metering 状态信息
 */
export async function getMeteringStatus(sessionId: string): Promise<any | null> {
  if (!MULERUN_AGENT_KEY) {
    console.error('[MuleRun] Metering API 失败: MULERUN_AGENT_KEY 未配置');
    return null;
  }

  try {
    const url = `${MULERUN_API_BASE_URL}/sessions/metering/${sessionId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MULERUN_AGENT_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MuleRun] Metering 查询失败: HTTP ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MuleRun] Metering 查询异常:', error);
    return null;
  }
}
