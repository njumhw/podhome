# 快速安全修复步骤

## 当前状态分析

✅ **已完成**：
- Fail2ban已安装并运行
- SSH jail已启用（目前0个失败，0个封禁）

⚠️ **需要修复**：
1. Git pull冲突（本地有未跟踪文件）
2. UFW防火墙未安装
3. SSH配置不安全（允许root密码登录）

---

## 第一步：解决Git pull冲突

```bash
cd /opt/podroom

# 备份本地文件
mv scripts/diagnose-cpu-spike.sh scripts/diagnose-cpu-spike.sh.local 2>/dev/null

# 重新pull
git pull origin main

# 如果本地文件有重要修改，可以合并
# diff scripts/diagnose-cpu-spike.sh scripts/diagnose-cpu-spike.sh.local
```

## 第二步：安装UFW防火墙

```bash
# 安装UFW
sudo apt-get update
sudo apt-get install -y ufw

# 设置基本规则
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许SSH（重要！先允许SSH，否则可能无法连接）
sudo ufw allow 22/tcp

# 允许HTTP和HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 检查状态
sudo ufw status verbose
```

## 第三步：SSH安全加固（重要！）

当前SSH配置不安全：
- `PermitRootLogin yes` - 允许root登录
- `PasswordAuthentication yes` - 允许密码登录

### 选项A：使用SSH密钥（推荐）

```bash
# 1. 在本地生成SSH密钥（如果还没有）
# ssh-keygen -t rsa -b 4096

# 2. 将公钥复制到服务器
# ssh-copy-id -p 22 root@your.server.ip

# 3. 测试密钥登录是否正常

# 4. 编辑SSH配置
sudo nano /etc/ssh/sshd_config

# 修改以下配置：
PermitRootLogin prohibit-password  # 只允许密钥登录
PasswordAuthentication no          # 禁用密码登录
PubkeyAuthentication yes          # 启用密钥认证

# 5. 保存后重启SSH（⚠️ 确保密钥登录正常后再执行）
sudo systemctl restart sshd
```

### 选项B：暂时保持密码登录，但限制root

```bash
# 编辑SSH配置
sudo nano /etc/ssh/sshd_config

# 修改：
PermitRootLogin no  # 禁止root登录
# 创建一个普通用户用于SSH登录
# adduser admin
# usermod -aG sudo admin

# 保存后重启SSH
sudo systemctl restart sshd
```

### 选项C：更改SSH端口（降低被扫描概率）

```bash
# 编辑SSH配置
sudo nano /etc/ssh/sshd_config

# 修改：
Port 2222  # 改为其他端口（如2222）

# 保存后：
# 1. 先更新防火墙规则
sudo ufw allow 2222/tcp

# 2. 重启SSH
sudo systemctl restart sshd

# 3. 测试新端口连接正常后，可以删除22端口规则
# sudo ufw delete allow 22/tcp
```

## 第四步：运行完整安全检查

```bash
cd /opt/podroom
git pull origin main
chmod +x scripts/check-security-status.sh
./scripts/check-security-status.sh
```

## 第五步：更改root密码

```bash
# 更改root密码（使用强密码）
passwd

# 如果创建了普通用户，也要更改密码
# passwd admin
```

## 一键执行脚本

```bash
cd /opt/podroom

# 解决Git冲突
mv scripts/diagnose-cpu-spike.sh scripts/diagnose-cpu-spike.sh.local 2>/dev/null
git pull origin main

# 安装UFW
sudo apt-get update
sudo apt-get install -y ufw

# 配置防火墙
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 检查状态
echo ""
echo "=== 防火墙状态 ==="
sudo ufw status verbose

echo ""
echo "=== Fail2ban状态 ==="
sudo fail2ban-client status sshd

echo ""
echo "=== SSH配置 ==="
grep -E "^PermitRootLogin|^PasswordAuthentication|^Port" /etc/ssh/sshd_config

echo ""
echo "✅ 基础安全设置完成！"
echo "⚠️  下一步：加固SSH配置（见上面的选项A/B/C）"
```

## 安全优先级

### 高优先级（立即执行）
1. ✅ 解决Git冲突，获取最新脚本
2. ✅ 安装并启用UFW防火墙
3. ⚠️ 更改root密码
4. ⚠️ 加固SSH配置（选择上面的选项A/B/C之一）

### 中优先级（本周内）
1. 配置SSH密钥（如果选择选项A）
2. 更改SSH端口（可选）
3. 设置自动备份

### 低优先级（可选）
1. 限制Nginx访问
2. 系统自动更新
3. 邮件告警

## 验证清单

执行以下命令，确认所有项目：

```bash
# 1. Fail2ban运行正常
sudo systemctl is-active fail2ban && echo "✅ Fail2ban运行中"

# 2. 防火墙已启用
sudo ufw status | grep -q "Status: active" && echo "✅ 防火墙已启用"

# 3. SSH配置已加固
grep -q "^PermitRootLogin prohibit-password\|^PermitRootLogin no" /etc/ssh/sshd_config && echo "✅ SSH root登录已限制"
grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config && echo "✅ 密码登录已禁用"

# 4. 无可疑进程
ps aux | grep -E "\.update|weball|12323" | grep -v grep || echo "✅ 无可疑进程"

# 5. 配置文件干净
grep -l "\.update" /etc/profile /root/.bashrc 2>/dev/null || echo "✅ 配置文件干净"
```

