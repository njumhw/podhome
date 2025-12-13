/**
 * MuleRun 签名验证（严格按照官方文档实现）
 * 参考：https://mulerun.com/docs/creator-guide/agent/iframe-agent-spec#signature-verification
 */

import crypto from 'crypto';

/**
 * 验证 MuleRun 请求签名
 * 
 * 文档要求：
 * 1. 所有参数必须 URL 解码
 * 2. 解析为字典，按 key 排序
 * 3. 序列化为 JSON（使用 separators=(',', ':')，sort_keys=True）
 * 4. 使用 HMAC SHA-256 计算签名
 * 5. 使用 Agent Key 作为密钥
 * 
 * @param params - URL 参数（已包含 signature）
 * @param agentKey - MuleRun Agent Key
 * @returns 验证是否通过
 */
export function verifyMulerunSignature(
  params: Record<string, string>,
  agentKey: string
): boolean {
  try {
    // 1. URL 解码所有参数（文档要求）
    // 注意：Next.js 的 searchParams 可能已经自动解码，但为了安全，我们仍然尝试解码
    const decoded: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      try {
        // 如果已经是解码后的值，decodeURIComponent 不会改变它
        // 如果包含编码字符，则会被解码
        decoded[key] = decodeURIComponent(value);
      } catch {
        // 如果解码失败，使用原值（可能已经是解码后的）
        decoded[key] = value;
      }
    }

    // 2. 提取 signature（文档要求移除 signature 参数）
    const receivedSignature = decoded.signature;
    if (!receivedSignature) {
      console.error('[MuleRun] 签名验证失败: 缺少 signature 参数');
      return false;
    }

    // 3. 移除 signature 参数
    delete decoded.signature;

    // 4. 按 key 排序（文档要求 sort_keys=True）
    const sortedKeys = Object.keys(decoded).sort();

    // 5. 序列化为 JSON（文档要求 separators=(',', ':')）
    // 使用 JSON.stringify 的默认行为（无空格，符合 separators=(',', ':')）
    const sortedParams: Record<string, string> = {};
    for (const key of sortedKeys) {
      sortedParams[key] = decoded[key];
    }
    const jsonString = JSON.stringify(sortedParams);

    // 6. 计算 HMAC SHA-256（文档要求）
    const hmac = crypto.createHmac('sha256', agentKey);
    hmac.update(jsonString);
    const expectedSignature = hmac.digest('hex');

    // 7. 比较签名（文档要求 64 字符的 hex 字符串）
    const isValid = expectedSignature === receivedSignature;

    if (!isValid) {
      console.error('[MuleRun] 签名验证失败:', {
        expected: expectedSignature,
        received: receivedSignature,
        jsonString,
        sortedParams,
        agentKeyPrefix: agentKey ? `${agentKey.substring(0, 10)}...` : 'undefined',
        agentKeyLength: agentKey?.length,
        agentKeyEnd: agentKey ? `...${agentKey.substring(agentKey.length - 10)}` : 'undefined',
        // 输出 Agent Key 的完整值（用于调试，生产环境应移除）
        agentKeyFull: agentKey,
      });
    } else {
      console.log('[MuleRun] 签名验证成功');
    }

    return isValid;
  } catch (error) {
    console.error('[MuleRun] 签名验证异常:', error);
    return false;
  }
}

/**
 * 验证时间戳（防止重放攻击）
 * 文档要求：time 参数是 UTC 时间戳
 * 
 * @param timeStr - 时间戳字符串
 * @param maxAgeSeconds - 最大时间差（秒），默认 5 分钟
 * @returns 时间戳是否有效
 */
export function verifyTimestamp(
  timeStr: string,
  maxAgeSeconds: number = 300
): boolean {
  try {
    const timestamp = parseInt(timeStr, 10);
    if (isNaN(timestamp)) {
      return false;
    }

    const requestTime = new Date(timestamp * 1000);
    const now = new Date();
    const diffSeconds = Math.abs((now.getTime() - requestTime.getTime()) / 1000);

    // 允许的时间差（防止时钟不同步）
    if (diffSeconds > maxAgeSeconds) {
      console.warn(`[MuleRun] 时间戳验证失败: 时间差 ${diffSeconds} 秒超过允许范围 ${maxAgeSeconds} 秒`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[MuleRun] 时间戳验证异常:', error);
    return false;
  }
}
