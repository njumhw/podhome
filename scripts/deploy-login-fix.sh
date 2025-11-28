#!/bin/bash

# 部署登录修复脚本
# 在服务器上执行此脚本来应用登录修复

set -e

echo "=========================================="
echo "开始部署登录修复"
echo "=========================================="
echo ""

cd /opt/podroom

# 1. 拉取最新代码
echo "1. 拉取最新代码..."
git pull origin main
echo "✅ 代码拉取完成"
echo ""

# 2. 安装依赖（如果需要）
echo "2. 检查依赖..."
if [ -f "package.json" ]; then
    pnpm install
    echo "✅ 依赖安装完成"
else
    echo "⚠️  未找到 package.json，跳过依赖安装"
fi
echo ""

# 3. 生成 Prisma Client
echo "3. 生成 Prisma Client..."
npx prisma generate
echo "✅ Prisma Client 生成完成"
echo ""

# 4. 构建应用
echo "4. 构建应用..."
pnpm build
echo "✅ 构建完成"
echo ""

# 5. 重启 PM2 服务
echo "5. 重启 PM2 服务..."
pm2 restart podroom || pm2 start ecosystem.config.js
echo "✅ 服务重启完成"
echo ""

# 6. 检查服务状态
echo "6. 检查服务状态..."
pm2 status
echo ""

echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "请测试登录功能："
echo "1. 清除浏览器 Cookie 和缓存"
echo "2. 访问 http://47.117.77.211:3005/home"
echo "3. 尝试登录"
echo ""

