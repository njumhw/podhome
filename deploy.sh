#!/bin/bash

# 阿里云服务器部署脚本
# 使用方法: ./deploy.sh
# 
# 完整部署流程：
# 1. 更新代码 (git pull)
# 2. 安装依赖 (pnpm install)
# 3. 生成Prisma客户端 (prisma generate)
# 4. 构建应用 (next build)
# 5. 重启PM2应用 (pm2 restart)

set -e

echo "═══════════════════════════════════════════════════════════"
echo "🚀 开始部署播客应用..."
echo "═══════════════════════════════════════════════════════════"

# 确保在项目目录
cd /opt/podroom || { echo "❌ 错误: 无法进入 /opt/podroom 目录"; exit 1; }

# 0. 检查环境
echo ""
echo "📋 步骤 0/6: 检查环境..."
node --version
pnpm --version
pm2 --version || { echo "❌ PM2 未安装，请先安装: npm install -g pm2"; exit 1; }

# 1. 更新代码
echo ""
echo "📥 步骤 1/6: 更新代码..."
echo "当前代码版本:"
git log --oneline -1 || echo "⚠️ 警告: 无法获取git信息"

echo "拉取最新代码..."
git fetch origin
git pull origin main || { echo "❌ 错误: git pull 失败"; exit 1; }

echo "✅ 代码已更新到:"
git log --oneline -1

# 2. 安装依赖
echo ""
echo "📦 步骤 2/6: 安装依赖..."
pnpm install --frozen-lockfile || { echo "❌ 错误: 依赖安装失败"; exit 1; }
echo "✅ 依赖安装完成"

# 3. 生成Prisma客户端
echo ""
echo "🗄️ 步骤 3/6: 生成Prisma客户端..."
pnpm prisma generate || { echo "❌ 错误: Prisma生成失败"; exit 1; }
echo "✅ Prisma客户端已生成"

# 4. 构建应用
echo ""
echo "🔨 步骤 4/6: 构建应用..."
echo "⚠️ 这可能需要5-15分钟，请耐心等待..."
NODE_OPTIONS='--max-old-space-size=1536' pnpm build || { 
    echo "❌ 错误: 构建失败"
    echo "💡 提示: 如果内存不足，请检查swap空间: free -h"
    exit 1
}
echo "✅ 应用构建完成"

# 5. 重启应用
echo ""
echo "▶️ 步骤 5/6: 重启应用..."

# 检查应用是否存在
if pm2 list | grep -q "podroom"; then
    echo "应用已存在，执行重启..."
    pm2 restart podroom || { echo "❌ 错误: 应用重启失败"; exit 1; }
else
    echo "应用不存在，启动新应用..."
    pm2 start ecosystem.config.js --env production || { echo "❌ 错误: 应用启动失败"; exit 1; }
fi

# 等待应用启动
echo "等待应用启动..."
sleep 5

# 检查应用状态
echo ""
echo "📊 应用状态:"
pm2 status podroom

# 6. 保存PM2配置
echo ""
echo "💾 步骤 6/6: 保存PM2配置..."
pm2 save || echo "⚠️ 警告: pm2 save 失败（可能已保存）"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ 部署完成！"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs podroom"
echo "🔄 重启应用: pm2 restart podroom"
echo "🌐 测试访问: curl http://localhost:3005"
echo ""