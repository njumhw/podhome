import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client'],
  typescript: {
    ignoreBuildErrors: false
  },
  eslint: {
    ignoreDuringBuilds: false
  },
  // 性能优化配置
  compress: true, // 启用 gzip 压缩
  poweredByHeader: false, // 移除 X-Powered-By 头
  // 优化图片加载
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // 优化构建输出
  swcMinify: true, // 使用 SWC 压缩（Next.js 15 默认启用）
  // 实验性功能：优化包大小
  experimental: {
    optimizePackageImports: ['react-markdown', 'remark-gfm'],
  },
};

export default nextConfig;
