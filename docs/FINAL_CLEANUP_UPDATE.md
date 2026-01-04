# 最终清理 .update 残留

## 问题分析

虽然 `grep` 没有找到 `.update`，但错误信息显示：
- `/root/.bashrc: line 17: /usr/bin/.update: No such file or directory`
- `/etc/profile: line 34: /usr/bin/.update: No such file or directory`
- `/etc/profile: line 40: /usr/bin/.update: No such file or directory`

这说明这些行可能：
1. 被注释了（`# /usr/bin/.update`），但仍在执行
2. 有特殊字符或格式
3. `sed` 命令没有匹配到

## 立即执行：查看并删除这些行

```bash
# 1. 查看 /root/.bashrc 第17行和附近内容
echo "=== /root/.bashrc 第15-20行 ==="
sed -n '15,20p' /root/.bashrc

# 2. 查看 /etc/profile 第34行和40行附近内容
echo ""
echo "=== /etc/profile 第32-42行 ==="
sed -n '32,42p' /etc/profile

# 3. 查看所有包含 .update 的行（包括注释）
echo ""
echo "=== 所有包含 .update 的行（包括注释） ==="
grep -n "update" /root/.bashrc /etc/profile | grep -v "^#"

# 4. 直接删除这些行（根据行号）
echo ""
echo "=== 删除指定行 ==="
# 备份
cp /root/.bashrc /root/.bashrc.backup.$(date +%Y%m%d_%H%M%S)
cp /etc/profile /etc/profile.backup.$(date +%Y%m%d_%H%M%S)

# 删除 /root/.bashrc 第17行（如果包含 .update）
sed -i '17d' /root/.bashrc

# 删除 /etc/profile 第34行和40行（如果包含 .update）
sed -i '34d;40d' /etc/profile

# 或者更安全的方法：删除所有包含 .update 的行（包括注释）
sed -i '/\.update/d' /root/.bashrc /etc/profile
sed -i '/update.*startup/d' /root/.bashrc /etc/profile
sed -i '/while true/,/done &/d' /root/.bashrc /etc/profile

# 5. 验证删除结果
echo ""
echo "=== 验证删除结果 ==="
grep -n "update\|while true" /root/.bashrc /etc/profile || echo "✅ 已完全清理"

# 6. 重新加载配置
source /etc/profile
source /root/.bashrc
```

## 更彻底的清理方法

如果上述方法不行，可以手动编辑文件：

```bash
# 1. 查看文件内容
cat -n /root/.bashrc | grep -A 2 -B 2 "17"
cat -n /etc/profile | grep -A 2 -B 2 "34\|40"

# 2. 使用 nano 或 vi 手动编辑
nano /root/.bashrc
# 找到第17行，删除包含 .update 的行

nano /etc/profile
# 找到第34行和40行，删除包含 .update 的行

# 3. 或者使用 sed 更精确地删除
# 删除包含 /usr/bin/.update 的所有行
sed -i '\|/usr/bin/\.update|d' /root/.bashrc /etc/profile

# 删除包含 .update 的所有行（包括注释）
sed -i '/\.update/d' /root/.bashrc /etc/profile

# 删除 while true 循环
sed -i '/while true/,/done &/d' /root/.bashrc /etc/profile
```

## 一键清理脚本

```bash
cat > /tmp/cleanup-update.sh << 'EOF'
#!/bin/bash

echo "开始清理 .update 残留..."

# 备份
cp /root/.bashrc /root/.bashrc.backup.$(date +%Y%m%d_%H%M%S)
cp /etc/profile /etc/profile.backup.$(date +%Y%m%d_%H%M%S)

# 方法1：删除所有包含 .update 的行
sed -i '/\.update/d' /root/.bashrc /etc/profile

# 方法2：删除包含 /usr/bin/.update 的行
sed -i '\|/usr/bin/\.update|d' /root/.bashrc /etc/profile

# 方法3：删除 while true 循环
sed -i '/while true/,/done &/d' /root/.bashrc /etc/profile

# 方法4：删除包含 update 和 startup 的行
sed -i '/update.*startup/d' /root/.bashrc /etc/profile

# 验证
echo ""
echo "验证结果："
if grep -q "\.update\|while true" /root/.bashrc /etc/profile 2>/dev/null; then
    echo "⚠️ 仍有残留，显示："
    grep -n "\.update\|while true" /root/.bashrc /etc/profile
else
    echo "✅ 已完全清理"
fi

echo ""
echo "清理完成！请重新登录或执行 source /etc/profile && source /root/.bashrc"
EOF

chmod +x /tmp/cleanup-update.sh
/tmp/cleanup-update.sh
```

