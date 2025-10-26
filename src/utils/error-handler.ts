import { NextResponse } from 'next/server';

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: any;
}

export class AppError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status: number = 500, code?: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  // 如果是我们自定义的错误
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.status }
    );
  }

  // 如果是Prisma错误
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as any;
    
    switch (prismaError.code) {
      case 'P1001':
        return NextResponse.json(
          { error: '数据库连接失败', code: 'DB_CONNECTION_ERROR' },
          { status: 503 }
        );
      case 'P1017':
        return NextResponse.json(
          { error: '数据库连接已关闭', code: 'DB_CONNECTION_CLOSED' },
          { status: 503 }
        );
      case 'P2024':
        return NextResponse.json(
          { error: '数据库查询超时', code: 'DB_QUERY_TIMEOUT' },
          { status: 504 }
        );
      case 'P2002':
        return NextResponse.json(
          { error: '数据已存在', code: 'DUPLICATE_ENTRY' },
          { status: 409 }
        );
      case 'P2025':
        return NextResponse.json(
          { error: '记录不存在', code: 'RECORD_NOT_FOUND' },
          { status: 404 }
        );
      default:
        return NextResponse.json(
          { error: '数据库操作失败', code: 'DB_ERROR' },
          { status: 500 }
        );
    }
  }

  // 如果是网络错误
  if (error && typeof error === 'object' && 'name' in error) {
    const networkError = error as any;
    if (networkError.name === 'HeadersTimeoutError' || networkError.name === 'TimeoutError') {
      return NextResponse.json(
        { error: '请求超时', code: 'TIMEOUT_ERROR' },
        { status: 504 }
      );
    }
  }

  // 默认错误处理
  return NextResponse.json(
    {
      error: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    },
    { status: 500 }
  );
}

// 包装API处理函数的装饰器
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      throw error; // 让调用者处理错误
    }
  };
}

// 数据库重试机制
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // 如果是数据库连接错误，进行重试
      if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as any;
        if (['P1001', 'P1017', 'P2024'].includes(prismaError.code)) {
          if (attempt < maxRetries) {
            console.warn(`数据库操作失败，第${attempt}次重试...`, error);
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
            continue;
          }
        }
      }
      
      // 其他错误直接抛出
      throw error;
    }
  }
  
  throw lastError;
}
