#!/bin/bash

# 删除PM2中的stock-backend和stock-frontend应用
# 使用方法: ./scripts/remove-stock-apps.sh

set -e

echo "🗑️  开始删除stock应用..."

# 1. 停止并删除stock-backend
echo "📦 删除 stock-backend..."
pm2 stop stock-backend 2>/dev/null || echo "  stock-backend 未运行或已停止"
pm2 delete stock-backend 2>/dev/null || echo "  stock-backend 不存在"

# 2. 停止并删除stock-frontend
echo "📦 删除 stock-frontend..."
pm2 stop stock-frontend 2>/dev/null || echo "  stock-frontend 未运行或已停止"
pm2 delete stock-frontend 2>/dev/null || echo "  stock-frontend 不存在"

# 3. 保存PM2配置
echo "💾 保存PM2配置..."
pm2 save

# 4. 显示当前状态
echo ""
echo "📊 当前PM2状态:"
pm2 status

echo ""
echo "✅ 删除完成！"
echo ""
echo "💡 提示："
echo "  - 如果还需要删除应用文件，请手动删除对应的目录"
echo "  - 查看PM2日志: pm2 logs"
echo "  - 查看PM2状态: pm2 status"

