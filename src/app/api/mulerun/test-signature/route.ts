/**
 * MuleRun 测试签名生成 API
 * 用于本地测试，生成有效的签名参数
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const MULERUN_AGENT_KEY = process.env.MULERUN_AGENT_KEY;

/**
 * POST - 生成测试签名参数
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentKey } = body;

    // 使用请求中的 agentKey 或环境变量中的
    const key = agentKey || MULERUN_AGENT_KEY;

    if (!key) {
      return NextResponse.json(
        { error: 'Agent Key is required' },
        { status: 400 }
      );
    }

    // 生成测试参数
    const userId = 'test-user-' + Date.now();
    const sessionId = 'test-session-' + Date.now();
    const agentId = 'test-agent-' + Date.now();
    const time = Math.floor(Date.now() / 1000).toString();
    const origin = 'https://mulerun.com';
    const nonce = crypto.randomBytes(16).toString('hex');

    // 构建参数对象（不包含 signature）
    const params: Record<string, string> = {
      userId,
      sessionId,
      agentId,
      time,
      origin,
      nonce,
    };

    // 按 key 排序
    const sortedKeys = Object.keys(params).sort();
    const sortedParams: Record<string, string> = {};
    for (const key of sortedKeys) {
      sortedParams[key] = params[key];
    }

    // 序列化为 JSON
    const jsonString = JSON.stringify(sortedParams);

    // 计算 HMAC SHA-256 签名
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(jsonString);
    const signature = hmac.digest('hex');

    // 添加 signature 到参数
    params.signature = signature;

    return NextResponse.json({
      success: true,
      params,
      queryString: new URLSearchParams(params).toString(),
    });
  } catch (error) {
    console.error('[MuleRun] 生成测试签名失败:', error);
    return NextResponse.json(
      { error: 'Failed to generate test signature' },
      { status: 500 }
    );
  }
}

