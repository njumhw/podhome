import { NextResponse } from 'next/server';

export async function GET() {
  // 检查OSS环境变量
  const env = {
    ALIYUN_ACCESS_KEY_ID: process.env.ALIYUN_ACCESS_KEY_ID,
    ALIYUN_ACCESS_KEY_SECRET: process.env.ALIYUN_ACCESS_KEY_SECRET,
    ALIYUN_OSS_REGION: process.env.ALIYUN_OSS_REGION,
    ALIYUN_OSS_BUCKET: process.env.ALIYUN_OSS_BUCKET,
  };

  const status = {
    hasAccessKeyId: !!env.ALIYUN_ACCESS_KEY_ID,
    hasAccessKeySecret: !!env.ALIYUN_ACCESS_KEY_SECRET,
    hasRegion: !!env.ALIYUN_OSS_REGION,
    hasBucket: !!env.ALIYUN_OSS_BUCKET,
    region: env.ALIYUN_OSS_REGION,
    bucket: env.ALIYUN_OSS_BUCKET,
    accessKeyIdLength: env.ALIYUN_ACCESS_KEY_ID?.length || 0,
    accessKeySecretLength: env.ALIYUN_ACCESS_KEY_SECRET?.length || 0,
    allConfigured: !!(env.ALIYUN_ACCESS_KEY_ID && env.ALIYUN_ACCESS_KEY_SECRET && env.ALIYUN_OSS_REGION && env.ALIYUN_OSS_BUCKET),
    nodeEnv: process.env.NODE_ENV,
    // 列出所有ALIYUN相关的环境变量（不显示值）
    allAliyunVars: Object.keys(process.env)
      .filter(key => key.includes('ALIYUN') || key.includes('OSS'))
      .map(key => ({
        key,
        hasValue: !!process.env[key],
        valueLength: process.env[key]?.length || 0
      }))
  };

  return NextResponse.json(status, { status: status.allConfigured ? 200 : 500 });
}

