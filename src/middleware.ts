import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 为播客相关的API添加缓存控制头
  if (request.nextUrl.pathname.startsWith('/api/public/podcast') ||
      request.nextUrl.pathname.startsWith('/api/data-consistency') ||
      request.nextUrl.pathname.startsWith('/api/queue-status')) {
    
    // 防止缓存
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    // 添加版本头，便于调试
    response.headers.set('X-API-Version', '1.0');
    response.headers.set('X-Timestamp', Date.now().toString());
  }

  return response;
}

export const config = {
  matcher: [
    '/api/public/podcast/:path*',
    '/api/data-consistency/:path*',
    '/api/queue-status/:path*'
  ]
};

