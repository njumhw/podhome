#!/bin/bash

# 彻底清理恶意脚本

echo "=========================================="
echo "彻底清理恶意脚本"
echo "=========================================="
echo ""

# 备份文件
BACKUP_DIR="/root/backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 1. 备份并修复 /etc/profile
echo "=== 1. 修复 /etc/profile ==="
if [ -f /etc/profile ]; then
    cp /etc/profile "$BACKUP_DIR/profile.backup"
    echo "✅ 已备份到: $BACKUP_DIR/profile.backup"
    
    # 查看第33行附近
    echo "第30-40行内容："
    sed -n '30,40p' /etc/profile
    echo ""
    
    # 删除所有包含 .update 的行
    sed -i '/\.update/d' /etc/profile
    echo "✅ 已删除所有包含 .update 的行"
    
    # 删除所有包含 "while true" 和 "startup" 的恶意循环
    sed -i '/while true/,/done &/d' /etc/profile
    echo "✅ 已删除恶意循环"
    
    # 检查语法
    if bash -n /etc/profile 2>/dev/null; then
        echo "✅ /etc/profile 语法检查通过"
    else
        echo "❌ /etc/profile 语法错误，请手动检查"
        bash -n /etc/profile
    fi
else
    echo "❌ /etc/profile 不存在"
fi
echo ""

# 2. 备份并修复 /root/.bashrc
echo "=== 2. 修复 /root/.bashrc ==="
if [ -f /root/.bashrc ]; then
    cp /root/.bashrc "$BACKUP_DIR/bashrc.backup"
    echo "✅ 已备份到: $BACKUP_DIR/bashrc.backup"
    
    # 查看第10行附近
    echo "第5-15行内容："
    sed -n '5,15p' /root/.bashrc
    echo ""
    
    # 删除所有包含 .update 的行
    sed -i '/\.update/d' /root/.bashrc
    echo "✅ 已删除所有包含 .update 的行"
    
    # 删除所有包含 "while true" 和 "startup" 的恶意循环
    sed -i '/while true/,/done &/d' /root/.bashrc
    echo "✅ 已删除恶意循环"
    
    # 检查语法
    if bash -n /root/.bashrc 2>/dev/null; then
        echo "✅ /root/.bashrc 语法检查通过"
    else
        echo "❌ /root/.bashrc 语法错误，请手动检查"
        bash -n /root/.bashrc
    fi
else
    echo "❌ /root/.bashrc 不存在"
fi
echo ""

# 3. 检查其他配置文件
echo "=== 3. 检查其他配置文件 ==="
for file in /etc/bash.bashrc /etc/bashrc /etc/profile.d/*.sh; do
    if [ -f "$file" ]; then
        if grep -q "\.update" "$file" 2>/dev/null; then
            echo "⚠️  发现 $file 中有 .update，需要清理"
            cp "$file" "$BACKUP_DIR/$(basename $file).backup"
            sed -i '/\.update/d' "$file"
            echo "✅ 已清理 $file"
        fi
    fi
done
echo ""

# 4. 检查定时任务
echo "=== 4. 检查定时任务 ==="
if crontab -l 2>/dev/null | grep -q "\.update"; then
    echo "⚠️  发现定时任务中有 .update"
    crontab -l > "$BACKUP_DIR/crontab.backup"
    crontab -l | grep -v "\.update" | crontab -
    echo "✅ 已清理定时任务"
else
    echo "✅ 定时任务中未发现 .update"
fi
echo ""

# 5. 检查系统定时任务
echo "=== 5. 检查系统定时任务 ==="
for cron_file in /etc/crontab /etc/cron.d/* /etc/cron.hourly/* /etc/cron.daily/*; do
    if [ -f "$cron_file" ] && grep -q "\.update" "$cron_file" 2>/dev/null; then
        echo "⚠️  发现 $cron_file 中有 .update"
        cp "$cron_file" "$BACKUP_DIR/$(basename $cron_file).backup"
        sed -i '/\.update/d' "$cron_file"
        echo "✅ 已清理 $cron_file"
    fi
done
echo ""

# 6. 验证修复结果
echo "=== 6. 验证修复结果 ==="
echo "检查 /etc/profile 中是否还有 .update："
if grep -q "\.update" /etc/profile 2>/dev/null; then
    echo "❌ 仍有残留，行号："
    grep -n "\.update" /etc/profile
else
    echo "✅ /etc/profile 已清理干净"
fi

echo ""
echo "检查 /root/.bashrc 中是否还有 .update："
if grep -q "\.update" /root/.bashrc 2>/dev/null; then
    echo "❌ 仍有残留，行号："
    grep -n "\.update" /root/.bashrc
else
    echo "✅ /root/.bashrc 已清理干净"
fi
echo ""

# 7. 显示备份位置
echo "=========================================="
echo "备份文件位置: $BACKUP_DIR"
echo "=========================================="
ls -la "$BACKUP_DIR"
echo ""

echo "✅ 清理完成！请重新登录或执行 'source /etc/profile' 验证"

