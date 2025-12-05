#!/bin/bash
# 稳定的部署脚本 - 带重试机制和错误处理
# 使用方法: ./scripts/deploy-stable.sh

set -e  # 遇到错误立即退出

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "=========================================="
echo "开始部署 - $(date)"
echo "项目目录: $PROJECT_DIR"
echo "=========================================="

# ========== 配置 Git ==========
echo ""
echo "📝 配置 Git..."
git config --global http.postBuffer 524288000 || true
git config --global http.lowSpeedLimit 0 || true
git config --global http.lowSpeedTime 999999 || true

# ========== 停止服务 ==========
echo ""
echo "🛑 停止服务..."
if command -v pm2 &> /dev/null; then
    pm2 stop podroom 2>/dev/null || echo "  服务未运行或不存在"
else
    echo "  PM2 未安装，跳过服务停止"
fi

# ========== 拉取代码（带重试） ==========
echo ""
echo "📥 拉取代码..."

MAX_RETRIES=5
RETRY_DELAY=10

for i in $(seq 1 $MAX_RETRIES); do
    echo "  尝试 $i/$MAX_RETRIES..."
    
    # 尝试拉取
    if git fetch origin 2>&1; then
        echo "  ✅ fetch 成功"
        
        # 重置到远程分支
        if git reset --hard origin/main 2>&1; then
            echo "  ✅ reset 成功"
            
            # 清理未跟踪文件
            git clean -fd 2>&1 || true
            echo "  ✅ 代码拉取完成！"
            break
        else
            echo "  ❌ reset 失败"
        fi
    else
        echo "  ❌ fetch 失败"
    fi
    
    # 如果不是最后一次尝试，等待后重试
    if [ $i -lt $MAX_RETRIES ]; then
        echo "  ⏳ 等待 ${RETRY_DELAY} 秒后重试..."
        sleep $RETRY_DELAY
        RETRY_DELAY=$((RETRY_DELAY + 5))  # 每次重试增加等待时间
    else
        echo ""
        echo "❌ 所有重试都失败了！"
        echo ""
        echo "💡 建议："
        echo "  1. 检查网络连接"
        echo "  2. 检查 GitHub 访问是否正常"
        echo "  3. 尝试配置代理或使用 SSH"
        echo "  4. 查看详细错误信息"
        exit 1
    fi
done

# ========== 安装依赖 ==========
if [ -f "package.json" ]; then
    echo ""
    echo "📦 安装依赖..."
    
    if command -v pnpm &> /dev/null; then
        pnpm install --production
    elif command -v yarn &> /dev/null; then
        yarn install --production
    elif command -v npm &> /dev/null; then
        npm install --production
    else
        echo "  ⚠️  未找到包管理器（npm/yarn/pnpm）"
    fi
fi

# ========== 构建项目 ==========
if [ -f "package.json" ] && grep -q '"build"' package.json; then
    echo ""
    echo "🔨 构建项目..."
    
    if command -v pnpm &> /dev/null; then
        pnpm build
    elif command -v yarn &> /dev/null; then
        yarn build
    elif command -v npm &> /dev/null; then
        npm run build
    fi
fi

# ========== 数据库迁移 ==========
if [ -f "prisma/schema.prisma" ]; then
    echo ""
    echo "🗄️  同步数据库..."
    
    if command -v npx &> /dev/null; then
        npx prisma generate || echo "  ⚠️  Prisma generate 失败"
        npx prisma db push || echo "  ⚠️  Prisma db push 失败（可能没有变更）"
    else
        echo "  ⚠️  npx 未找到，跳过数据库同步"
    fi
fi

# ========== 重启服务 ==========
echo ""
echo "🚀 重启服务..."

if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "podroom"; then
        pm2 restart podroom
    else
        # 如果服务不存在，尝试启动
        if [ -f "ecosystem.config.js" ] || [ -f "ecosystem.config.cjs" ]; then
            pm2 start ecosystem.config.js || pm2 start ecosystem.config.cjs || pm2 start npm --name podroom -- start
        else
            pm2 start npm --name podroom -- start
        fi
    fi
    
    echo ""
    echo "📊 PM2 状态："
    pm2 status
else
    echo "  ⚠️  PM2 未安装，请手动启动服务"
fi

# ========== 完成 ==========
echo ""
echo "=========================================="
echo "✅ 部署完成！ - $(date)"
echo "=========================================="


