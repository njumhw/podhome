#!/bin/bash

# 播客应用自动化部署脚本
# 使用方法: ./scripts/deploy.sh [环境] [分支]
# 例如: ./scripts/deploy.sh production main

set -e

# 配置变量
APP_NAME="podroom"
APP_DIR="/opt/podroom"
BACKUP_DIR="/opt/backups/podroom"
LOG_DIR="/var/log/podroom"
GIT_REPO="https://github.com/your-username/podroom.git"  # 替换为您的Git仓库
BRANCH=${2:-"main"}
ENV=${1:-"production"}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# 检查权限
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "请使用root权限运行此脚本"
    fi
}

# 创建必要目录
create_directories() {
    log "创建必要目录..."
    mkdir -p $APP_DIR
    mkdir -p $BACKUP_DIR
    mkdir -p $LOG_DIR
    mkdir -p $APP_DIR/logs
}

# 备份当前版本
backup_current() {
    if [ -d "$APP_DIR" ] && [ "$(ls -A $APP_DIR)" ]; then
        log "备份当前版本..."
        BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
        cp -r $APP_DIR $BACKUP_DIR/$BACKUP_NAME
        success "备份完成: $BACKUP_DIR/$BACKUP_NAME"
    fi
}

# 拉取最新代码
pull_code() {
    log "拉取最新代码..."
    
    if [ -d "$APP_DIR/.git" ]; then
        cd $APP_DIR
        git fetch origin
        git reset --hard origin/$BRANCH
        git clean -fd
    else
        git clone -b $BRANCH $GIT_REPO $APP_DIR
        cd $APP_DIR
    fi
    
    success "代码更新完成"
}

# 安装依赖
install_dependencies() {
    log "安装依赖..."
    cd $APP_DIR
    
    # 使用pnpm
    if command -v pnpm &> /dev/null; then
        pnpm install --frozen-lockfile
    else
        npm install --frozen-lockfile
    fi
    
    success "依赖安装完成"
}

# 构建应用
build_app() {
    log "构建应用..."
    cd $APP_DIR
    
    # 生成Prisma客户端
    if command -v pnpm &> /dev/null; then
        pnpm prisma generate
        pnpm build
    else
        npx prisma generate
        npm run build
    fi
    
    success "应用构建完成"
}

# 数据库迁移
migrate_database() {
    log "执行数据库迁移..."
    cd $APP_DIR
    
    if command -v pnpm &> /dev/null; then
        pnpm prisma db push
    else
        npx prisma db push
    fi
    
    success "数据库迁移完成"
}

# 重启应用
restart_app() {
    log "重启应用..."
    
    # 停止现有应用
    pm2 stop $APP_NAME 2>/dev/null || true
    
    # 启动应用
    pm2 start ecosystem.config.js --env $ENV
    
    # 等待应用启动
    sleep 5
    
    # 检查应用状态
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "应用启动成功"
    else
        error "应用启动失败，请检查日志: pm2 logs $APP_NAME"
    fi
}

# 健康检查
health_check() {
    log "执行健康检查..."
    
    # 等待应用完全启动
    sleep 10
    
    # 检查应用是否响应
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        success "健康检查通过"
    else
        warning "健康检查失败，但应用可能仍在启动中"
    fi
}

# 清理旧备份
cleanup_backups() {
    log "清理旧备份..."
    
    # 保留最近7天的备份
    find $BACKUP_DIR -type d -name "backup-*" -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
    
    success "清理完成"
}

# 主函数
main() {
    log "开始部署 $APP_NAME (环境: $ENV, 分支: $BRANCH)"
    
    check_permissions
    create_directories
    backup_current
    pull_code
    install_dependencies
    build_app
    migrate_database
    restart_app
    health_check
    cleanup_backups
    
    success "部署完成！"
    log "应用状态: pm2 status"
    log "应用日志: pm2 logs $APP_NAME"
    log "重启应用: pm2 restart $APP_NAME"
}

# 执行主函数
main "$@"

