#!/bin/bash

# 服务器环境检查脚本
# 用于检查阿里云服务器上的环境配置，特别是.env文件
# 使用方法: ./scripts/check-server-env.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[检查]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# 检查项计数
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# 检查命令是否存在
check_command() {
    if command -v $1 &> /dev/null; then
        success "$1 已安装"
        ((CHECKS_PASSED++))
        return 0
    else
        error "$1 未安装"
        ((CHECKS_FAILED++))
        return 1
    fi
}

# 检查环境变量
check_env_var() {
    local var_name=$1
    local required=${2:-true}
    
    if [ -f ".env" ]; then
        if grep -q "^${var_name}=" .env 2>/dev/null; then
            local value=$(grep "^${var_name}=" .env | cut -d '=' -f2- | sed 's/^"//;s/"$//')
            if [ -z "$value" ] || [ "$value" = "your-${var_name,,}" ] || [ "$value" = "your-*-here" ]; then
                warning "$var_name 已设置但值为空或默认值"
                ((CHECKS_WARNING++))
                return 1
            else
                success "$var_name 已正确设置"
                ((CHECKS_PASSED++))
                return 0
            fi
        else
            if [ "$required" = "true" ]; then
                error "$var_name 未设置（必需）"
                ((CHECKS_FAILED++))
                return 1
            else
                warning "$var_name 未设置（可选）"
                ((CHECKS_WARNING++))
                return 1
            fi
        fi
    else
        error ".env 文件不存在"
        ((CHECKS_FAILED++))
        return 1
    fi
}

echo ""
echo "=========================================="
echo "  服务器环境配置检查工具"
echo "=========================================="
echo ""

# 1. 检查基本命令
log "检查基本命令..."
check_command "node"
check_command "npm" || check_command "pnpm"
check_command "pm2"
check_command "git"
echo ""

# 2. 检查Node.js版本
log "检查Node.js版本..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
    success "Node.js 版本: $(node --version) (>= 18)"
    ((CHECKS_PASSED++))
else
    error "Node.js 版本过低: $(node --version) (需要 >= 18)"
    ((CHECKS_FAILED++))
fi
echo ""

# 3. 检查项目目录
log "检查项目目录..."
if [ -d "/opt/podroom" ]; then
    success "项目目录存在: /opt/podroom"
    cd /opt/podroom
    ((CHECKS_PASSED++))
else
    warning "项目目录不存在: /opt/podroom"
    if [ -d "$(pwd)" ] && [ -f "package.json" ]; then
        info "使用当前目录: $(pwd)"
        ((CHECKS_WARNING++))
    else
        error "未找到项目目录"
        ((CHECKS_FAILED++))
        exit 1
    fi
fi
echo ""

# 4. 检查.env文件
log "检查 .env 文件..."
if [ -f ".env" ]; then
    success ".env 文件存在"
    ((CHECKS_PASSED++))
    
    # 检查文件权限
    if [ -r ".env" ]; then
        success ".env 文件可读"
        ((CHECKS_PASSED++))
    else
        error ".env 文件不可读"
        ((CHECKS_FAILED++))
    fi
    
    # 检查是否包含敏感信息（简单检查）
    if grep -q "your-" .env 2>/dev/null || grep -q "example" .env 2>/dev/null; then
        warning ".env 文件中可能包含示例值，请检查"
        ((CHECKS_WARNING++))
    fi
else
    error ".env 文件不存在"
    info "请从 env.example 创建 .env 文件: cp env.example .env"
    ((CHECKS_FAILED++))
fi
echo ""

# 5. 检查必需的环境变量
log "检查必需的环境变量..."
echo ""

info "数据库配置:"
check_env_var "DATABASE_URL" true
echo ""

info "NextAuth 配置:"
check_env_var "NEXTAUTH_SECRET" true
check_env_var "NEXTAUTH_URL" true
echo ""

info "通义千问 API 配置:"
check_env_var "QWEN_API_KEY" true
echo ""

info "阿里云配置:"
check_env_var "ALIYUN_ACCESS_KEY_ID" true
check_env_var "ALIYUN_ACCESS_KEY_SECRET" true
check_env_var "ALIYUN_ASR_APP_KEY" false
echo ""

info "阿里云 OSS 配置:"
check_env_var "ALIYUN_OSS_BUCKET" true
check_env_var "ALIYUN_OSS_REGION" true
echo ""

info "Next.js 配置:"
check_env_var "NEXT_PUBLIC_BASE_URL" true
check_env_var "PORT" false
echo ""

# 6. 检查数据库连接（如果可能）
log "检查数据库连接..."
if check_env_var "DATABASE_URL" true > /dev/null 2>&1; then
    DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2- | sed 's/^"//;s/"$//')
    if [ ! -z "$DATABASE_URL" ]; then
        # 尝试简单的连接测试（需要psql）
        if command -v psql &> /dev/null; then
            if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
                success "数据库连接正常"
                ((CHECKS_PASSED++))
            else
                warning "数据库连接失败，请检查 DATABASE_URL"
                ((CHECKS_WARNING++))
            fi
        else
            info "psql 未安装，跳过数据库连接测试"
        fi
    fi
fi
echo ""

# 7. 检查PM2配置
log "检查 PM2 配置..."
if [ -f "ecosystem.config.js" ]; then
    success "ecosystem.config.js 存在"
    ((CHECKS_PASSED++))
    
    # 检查PM2进程
    if pm2 list | grep -q "podroom"; then
        PM2_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="podroom") | .pm2_env.status' 2>/dev/null || echo "unknown")
        if [ "$PM2_STATUS" = "online" ]; then
            success "PM2 进程 'podroom' 正在运行"
            ((CHECKS_PASSED++))
        else
            warning "PM2 进程 'podroom' 状态: $PM2_STATUS"
            ((CHECKS_WARNING++))
        fi
    else
        warning "PM2 进程 'podroom' 未运行"
        ((CHECKS_WARNING++))
    fi
else
    warning "ecosystem.config.js 不存在"
    ((CHECKS_WARNING++))
fi
echo ""

# 8. 检查日志目录
log "检查日志目录..."
if [ -d "/var/log/podroom" ]; then
    success "日志目录存在: /var/log/podroom"
    if [ -w "/var/log/podroom" ]; then
        success "日志目录可写"
        ((CHECKS_PASSED++))
    else
        warning "日志目录不可写，可能需要权限: sudo chown \$USER:\$USER /var/log/podroom"
        ((CHECKS_WARNING++))
    fi
    ((CHECKS_PASSED++))
else
    warning "日志目录不存在: /var/log/podroom"
    info "创建命令: sudo mkdir -p /var/log/podroom && sudo chown \$USER:\$USER /var/log/podroom"
    ((CHECKS_WARNING++))
fi
echo ""

# 9. 检查磁盘空间
log "检查磁盘空间..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    success "磁盘使用率: ${DISK_USAGE}% (正常)"
    ((CHECKS_PASSED++))
elif [ "$DISK_USAGE" -lt 90 ]; then
    warning "磁盘使用率: ${DISK_USAGE}% (较高)"
    ((CHECKS_WARNING++))
else
    error "磁盘使用率: ${DISK_USAGE}% (过高，需要清理)"
    ((CHECKS_FAILED++))
fi
echo ""

# 10. 检查内存
log "检查内存..."
TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
AVAIL_MEM=$(free -m | awk 'NR==2{print $7}')
if [ "$TOTAL_MEM" -ge 2048 ]; then
    success "总内存: ${TOTAL_MEM}MB, 可用: ${AVAIL_MEM}MB"
    ((CHECKS_PASSED++))
else
    warning "总内存: ${TOTAL_MEM}MB (建议至少 2GB)"
    ((CHECKS_WARNING++))
fi
echo ""

# 11. 检查网络连接（测试外部API）
log "检查网络连接..."
if curl -s --max-time 5 https://www.aliyun.com > /dev/null 2>&1; then
    success "网络连接正常（可访问阿里云）"
    ((CHECKS_PASSED++))
else
    warning "网络连接测试失败（可能只是暂时性问题）"
    ((CHECKS_WARNING++))
fi
echo ""

# 12. 检查构建文件
log "检查构建文件..."
if [ -d ".next" ]; then
    success ".next 目录存在（已构建）"
    ((CHECKS_PASSED++))
else
    warning ".next 目录不存在（需要构建）"
    ((CHECKS_WARNING++))
fi
echo ""

# 13. 检查Prisma客户端
log "检查 Prisma 客户端..."
if [ -d "node_modules/.prisma" ] || [ -d "node_modules/@prisma/client" ]; then
    success "Prisma 客户端已生成"
    ((CHECKS_PASSED++))
else
    warning "Prisma 客户端未生成，运行: npx prisma generate"
    ((CHECKS_WARNING++))
fi
echo ""

# 总结
echo ""
echo "=========================================="
echo "  检查结果总结"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ 通过: $CHECKS_PASSED${NC}"
echo -e "${YELLOW}⚠️  警告: $CHECKS_WARNING${NC}"
echo -e "${RED}❌ 失败: $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    if [ $CHECKS_WARNING -eq 0 ]; then
        success "所有检查通过！环境配置正常。"
        exit 0
    else
        warning "基本配置正常，但有一些警告需要关注。"
        exit 0
    fi
else
    error "发现 $CHECKS_FAILED 个严重问题，请先解决这些问题。"
    exit 1
fi




