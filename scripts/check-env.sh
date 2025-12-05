#!/bin/bash

# 检查生产环境 .env 文件配置
# 用于诊断登录问题

echo "=========================================="
echo "检查生产环境 .env 配置"
echo "=========================================="
echo ""

ENV_FILE="/opt/podroom/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env 文件不存在: $ENV_FILE"
    exit 1
fi

echo "✅ .env 文件存在"
echo ""

# 检查关键配置
echo "关键配置检查："
echo "----------------------------------------"

# 检查 NEXT_PUBLIC_BASE_URL
NEXT_PUBLIC_BASE_URL=$(grep "^NEXT_PUBLIC_BASE_URL=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
if [ -z "$NEXT_PUBLIC_BASE_URL" ]; then
    echo "❌ NEXT_PUBLIC_BASE_URL 未设置"
    echo "   应该设置为: http://47.117.77.211:3005"
else
    echo "✅ NEXT_PUBLIC_BASE_URL = $NEXT_PUBLIC_BASE_URL"
    if [[ "$NEXT_PUBLIC_BASE_URL" == http://* ]]; then
        echo "   ✅ 使用 HTTP 协议（正确）"
    elif [[ "$NEXT_PUBLIC_BASE_URL" == https://* ]]; then
        echo "   ⚠️  使用 HTTPS 协议（如果实际使用 HTTP，这会导致 Cookie 问题）"
    else
        echo "   ⚠️  格式可能不正确"
    fi
fi

echo ""

# 检查 NODE_ENV
NODE_ENV=$(grep "^NODE_ENV=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
if [ -z "$NODE_ENV" ]; then
    echo "❌ NODE_ENV 未设置"
    echo "   应该设置为: production"
else
    echo "✅ NODE_ENV = $NODE_ENV"
fi

echo ""

# 检查 USE_HTTPS
USE_HTTPS=$(grep "^USE_HTTPS=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
if [ -z "$USE_HTTPS" ]; then
    echo "✅ USE_HTTPS 未设置（默认 false，正确）"
else
    echo "⚠️  USE_HTTPS = $USE_HTTPS"
    if [ "$USE_HTTPS" = "true" ]; then
        echo "   ⚠️  如果实际使用 HTTP，这会导致 Cookie secure 问题"
    fi
fi

echo ""

# 检查 AUTH_SECRET
AUTH_SECRET=$(grep "^AUTH_SECRET=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
if [ -z "$AUTH_SECRET" ]; then
    echo "❌ AUTH_SECRET 未设置（必需）"
else
    echo "✅ AUTH_SECRET 已设置"
fi

echo ""

# 检查 DATABASE_URL
DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL 未设置（必需）"
else
    echo "✅ DATABASE_URL 已设置"
fi

echo ""
echo "=========================================="
echo "建议的配置（如果使用 HTTP）："
echo "=========================================="
echo "NEXT_PUBLIC_BASE_URL=http://47.117.77.211:3005"
echo "NODE_ENV=production"
echo "USE_HTTPS=false  # 或者不设置"
echo "AUTH_SECRET=你的密钥"
echo "DATABASE_URL=你的数据库连接字符串"
echo ""


