#!/bin/bash
# 检查磁盘使用情况的脚本

echo "=== 检查大目录（前20个）==="
du -h --max-depth=1 / 2>/dev/null | sort -hr | head -20

echo ""
echo "=== 检查项目目录大小 ==="
du -h --max-depth=2 /opt/podroom 2>/dev/null | sort -hr | head -20

echo ""
echo "=== 检查node_modules大小 ==="
if [ -d "/opt/podroom/node_modules" ]; then
    du -sh /opt/podroom/node_modules
fi

echo ""
echo "=== 检查.next目录大小 ==="
if [ -d "/opt/podroom/.next" ]; then
    du -sh /opt/podroom/.next
fi

echo ""
echo "=== 检查大文件（大于100MB）==="
find /opt/podroom -type f -size +100M 2>/dev/null | head -10

