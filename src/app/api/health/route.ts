import { NextResponse } from 'next/server';
import { db } from '@/server/db';

export async function GET() {
  try {
    // 检查数据库连接
    await db.$queryRaw`SELECT 1`;
    
    // 检查应用状态
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      },
      { status: 503 }
    );
  }
}

