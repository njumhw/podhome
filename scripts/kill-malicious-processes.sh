#!/bin/bash

# 终止恶意进程脚本
# ⚠️ 使用前请先运行诊断脚本确认

echo "=========================================="
echo "终止恶意进程脚本"
echo "⚠️  请先运行诊断脚本确认恶意进程"
echo "=========================================="
echo ""

# 1. 查找CPU占用最高的进程
echo "=== 查找CPU占用最高的进程 ==="
TOP_PROCESS=$(ps aux --sort=-%cpu | head -2 | tail -1)
echo "$TOP_PROCESS"
echo ""

# 2. 询问是否终止
read -p "是否要终止CPU占用最高的进程？(y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "已取消"
    exit 0
fi

# 3. 获取PID
PID=$(echo "$TOP_PROCESS" | awk '{print $2}')
PROCESS_NAME=$(echo "$TOP_PROCESS" | awk '{print $11}')

echo "准备终止进程: PID=$PID, 名称=$PROCESS_NAME"
read -p "确认终止？(y/n): " confirm2
if [ "$confirm2" != "y" ]; then
    echo "已取消"
    exit 0
fi

# 4. 终止进程
kill -9 "$PID" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ 进程 $PID 已终止"
else
    echo "❌ 终止失败，可能需要root权限"
    exit 1
fi

# 5. 等待并检查
sleep 2
if ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  进程仍在运行，尝试强制终止..."
    kill -9 "$PID" 2>/dev/null
else
    echo "✅ 进程已成功终止"
fi

# 6. 检查CPU使用率
echo ""
echo "当前CPU使用率："
top -bn1 | head -5

