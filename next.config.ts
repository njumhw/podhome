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
  // 启用 standalone 输出，用于 Docker 部署
  output: 'standalone',
};

export default nextConfig;
