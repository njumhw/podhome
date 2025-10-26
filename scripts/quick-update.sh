#!/bin/bash

# 快速更新脚本 - 适用于小改动
# 使用方法: ./scripts/quick-update.sh

set -e

APP_NAME="podroom"
APP_DIR="/opt/podroom"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log "开始快速更新..."

# 1. 拉取最新代码
log "拉取最新代码..."
cd $APP_DIR
git pull origin main

# 2. 安装依赖（如果有package.json变化）
if git diff HEAD~1 HEAD --name-only | grep -q "package.json\|pnpm-lock.yaml"; then
    log "检测到依赖变化，重新安装..."
    pnpm install --frozen-lockfile
fi

# 3. 构建应用
log "构建应用..."
pnpm build

# 4. 重启应用
log "重启应用..."
pm2 restart $APP_NAME

# 5. 等待启动
sleep 3

# 6. 检查状态
if pm2 list | grep -q "$APP_NAME.*online"; then
    success "快速更新完成！"
    log "应用状态: pm2 status"
else
    echo "❌ 应用启动失败，请检查日志: pm2 logs $APP_NAME"
    exit 1
fi
