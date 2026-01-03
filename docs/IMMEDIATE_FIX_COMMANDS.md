# 立即修复命令（手动执行）

## 问题
- `/etc/profile: line 33: /usr/bin/.update: No such file or directory`
- `/root/.bashrc: line 10: /usr/bin/.update: No such file or directory`

## 立即修复（复制粘贴执行）

```bash
# 1. 备份文件
cp /etc/profile /etc/profile.backup.$(date +%Y%m%d_%H%M%S)
cp /root/.bashrc /root/.bashrc.backup.$(date +%Y%m%d_%H%M%S)

# 2. 查看问题行
echo "=== /etc/profile 第30-40行 ==="
sed -n '30,40p' /etc/profile

echo ""
echo "=== /root/.bashrc 第5-15行 ==="
sed -n '5,15p' /root/.bashrc

# 3. 删除所有包含 .update 的行
sed -i '/\.update/d' /etc/profile
sed -i '/\.update/d' /root/.bashrc

# 4. 删除恶意循环（如果有 while true 循环）
sed -i '/while true/,/done &/d' /etc/profile
sed -i '/while true/,/done &/d' /root/.bashrc

# 5. 检查语法
bash -n /etc/profile && echo "✅ /etc/profile 语法正确" || echo "❌ /etc/profile 语法错误"
bash -n /root/.bashrc && echo "✅ /root/.bashrc 语法正确" || echo "❌ /root/.bashrc 语法错误"

# 6. 验证修复
echo ""
echo "=== 验证 /etc/profile ==="
grep -n "\.update" /etc/profile || echo "✅ 已清理干净"

echo ""
echo "=== 验证 /root/.bashrc ==="
grep -n "\.update" /root/.bashrc || echo "✅ 已清理干净"

# 7. 重新加载配置
source /etc/profile
source /root/.bashrc

echo ""
echo "✅ 修复完成！请退出重新登录验证"
```

## 检查CPU占用（修复后执行）

```bash
# 查看CPU占用最高的进程
ps aux --sort=-%cpu | head -11

# 检查可疑进程
ps aux | grep -E "\.update|\.sh|miner|mine|xmrig" | grep -v grep

# 检查网络连接
netstat -tulnp | grep ESTABLISHED | head -10
```

