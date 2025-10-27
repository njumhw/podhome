#!/bin/bash

# 回滚脚本
# 使用方法: ./scripts/rollback.sh [备份名称]

set -e

APP_NAME="podroom"
APP_DIR="/opt/podroom"
BACKUP_DIR="/opt/backups/podroom"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# 显示可用备份
show_backups() {
    log "可用的备份:"
    ls -la $BACKUP_DIR | grep "backup-" | awk '{print $9}' | sort -r
}

# 回滚到指定备份
rollback_to() {
    local backup_name=$1
    
    if [ -z "$backup_name" ]; then
        error "请指定备份名称"
    fi
    
    if [ ! -d "$BACKUP_DIR/$backup_name" ]; then
        error "备份不存在: $backup_name"
    fi
    
    log "回滚到备份: $backup_name"
    
    # 停止应用
    pm2 stop $APP_NAME
    
    # 备份当前版本
    CURRENT_BACKUP="current-$(date +%Y%m%d-%H%M%S)"
    cp -r $APP_DIR $BACKUP_DIR/$CURRENT_BACKUP
    log "当前版本已备份为: $CURRENT_BACKUP"
    
    # 恢复备份
    rm -rf $APP_DIR
    cp -r $BACKUP_DIR/$backup_name $APP_DIR
    
    # 重启应用
    pm2 start $APP_NAME
    
    # 等待启动
    sleep 5
    
    # 检查状态
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "回滚完成！"
    else
        error "回滚失败，请检查日志"
    fi
}

# 主函数
main() {
    if [ $# -eq 0 ]; then
        show_backups
        echo ""
        echo "使用方法: $0 <备份名称>"
        exit 1
    fi
    
    rollback_to $1
}

main "$@"

