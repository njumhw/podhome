#!/bin/bash

echo "=========================================="
echo "修复 /etc/profile 语法错误"
echo "=========================================="
echo ""

# 备份原文件
echo "=== 1. 备份 /etc/profile ==="
BACKUP_FILE="/etc/profile.backup.$(date +%Y%m%d_%H%M%S)"
cp /etc/profile "$BACKUP_FILE"
echo "已备份到: $BACKUP_FILE"
echo ""

# 查看问题行
echo "=== 2. 查看问题行（第30-45行）==="
sed -n '30,45p' /etc/profile
echo ""

# 检查 .update 相关行
echo "=== 3. 查找 .update 相关行 ==="
grep -n ".update" /etc/profile
echo ""

# 检查 .bashrc
echo "=== 4. 检查 /root/.bashrc ==="
if [ -f /root/.bashrc ]; then
    grep -n ".update" /root/.bashrc || echo "未找到 .update"
else
    echo ".bashrc 不存在"
fi
echo ""

# 提供修复建议
echo "=== 5. 修复建议 ==="
echo "请手动编辑 /etc/profile，删除或注释掉包含 '/usr/bin/.update' 的行"
echo ""
echo "执行以下命令编辑："
echo "  nano /etc/profile"
echo ""
echo "或使用 sed 临时修复（注释掉问题行）："
echo "  sed -i '31s|^|# |' /etc/profile"
echo "  sed -i '37s|^|# |' /etc/profile"
echo ""
echo "修复后检查语法："
echo "  bash -n /etc/profile"
echo ""

echo "=========================================="
echo "诊断完成"
echo "=========================================="

