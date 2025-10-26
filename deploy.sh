#!/bin/bash

# 阿里云服务器部署脚本
# 使用方法: ./deploy.sh

set -e

echo "🚀 开始部署播客应用..."

# 1. 检查环境
echo "📋 检查环境..."
node --version
pnpm --version
pm2 --version

# 2. 安装依赖
echo "📦 安装依赖..."
pnpm install

# 3. 生成Prisma客户端
echo "🗄️ 生成Prisma客户端..."
pnpm prisma generate

# 4. 构建应用
echo "🔨 构建应用..."
pnpm build

# 5. 启动应用
echo "▶️ 启动应用..."
pm2 delete podroom 2>/dev/null || true
pm2 start ecosystem.config.js

# 6. 保存PM2配置
pm2 save
pm2 startup

echo "✅ 部署完成！"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs podroom"
echo "🔄 重启应用: pm2 restart podroom"