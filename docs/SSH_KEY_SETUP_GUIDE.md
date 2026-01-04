# SSH密钥配置详细步骤

## 前提条件

- ✅ 你固定使用当前电脑登录服务器
- ✅ 服务器IP和root密码已知
- ✅ 当前可以正常SSH登录服务器

---

## 第一步：在本地生成SSH密钥

### 1.1 检查是否已有SSH密钥

```bash
# 在本地电脑执行（Mac/Linux）
ls -la ~/.ssh/id_rsa*

# 如果看到 id_rsa 和 id_rsa.pub，说明已有密钥，跳到第二步
# 如果没有，继续生成新密钥
```

### 1.2 生成新的SSH密钥

```bash
# 在本地电脑执行
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 按提示操作：
# 1. 保存位置：直接回车（使用默认位置 ~/.ssh/id_rsa）
# 2. 设置密码：建议设置一个密码保护私钥（输入密码，再确认一次）
#    - 这个密码用于保护你的私钥，每次使用密钥时会要求输入
#    - 如果不想设置密码，直接回车两次（不推荐，但更方便）

# 生成成功后，会显示：
# Your public key has been saved in /Users/your_username/.ssh/id_rsa.pub
```

### 1.3 验证密钥已生成

```bash
# 查看公钥内容
cat ~/.ssh/id_rsa.pub

# 应该看到类似这样的内容：
# ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQ... your_email@example.com
```

---

## 第二步：将公钥复制到服务器

### 方法1：使用 ssh-copy-id（推荐，最简单）

```bash
# 在本地电脑执行
ssh-copy-id root@your.server.ip

# 会提示输入root密码，输入后会自动复制公钥
# 成功后显示：
# Number of key(s) added: 1
# Now try logging into the machine: "ssh root@your.server.ip"
```

### 方法2：手动复制（如果方法1失败）

```bash
# 1. 在本地电脑查看公钥
cat ~/.ssh/id_rsa.pub

# 2. 复制整个公钥内容（从 ssh-rsa 开始到邮箱结束）

# 3. SSH登录服务器
ssh root@your.server.ip

# 4. 在服务器上执行（创建.ssh目录并设置权限）
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 5. 将公钥添加到authorized_keys
nano ~/.ssh/authorized_keys
# 粘贴刚才复制的公钥内容，保存退出（Ctrl+X, Y, Enter）

# 6. 设置正确的权限
chmod 600 ~/.ssh/authorized_keys

# 7. 退出服务器
exit
```

---

## 第三步：测试密钥登录（重要！）

### 3.1 测试密钥登录

```bash
# 在本地电脑执行
ssh root@your.server.ip

# 如果设置了密钥密码，会提示输入密钥密码
# 如果没设置密钥密码，应该直接登录成功（无需输入root密码）

# 登录成功后，你会看到服务器提示符：
# root@iZuf61540h5abguaovnh3hZ:~#
```

### 3.2 验证是否使用密钥登录

```bash
# 在服务器上执行
cat ~/.ssh/authorized_keys

# 应该看到你的公钥内容
# 确认后退出
exit
```

### 3.3 如果密钥登录失败

**问题1：仍然要求输入密码**
- 检查公钥是否正确复制
- 检查服务器上 `~/.ssh/authorized_keys` 文件权限（应该是600）
- 检查服务器上 `~/.ssh` 目录权限（应该是700）

**问题2：提示 "Permission denied (publickey)"**
- 检查服务器SSH配置是否允许密钥登录
- 执行：`grep PubkeyAuthentication /etc/ssh/sshd_config`
- 应该显示：`PubkeyAuthentication yes`

**问题3：提示密钥密码错误**
- 这是正常的，输入你生成密钥时设置的密码即可

---

## 第四步：在服务器上禁用密码登录

### 4.1 备份SSH配置文件

```bash
# 在服务器上执行
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)
```

### 4.2 编辑SSH配置

```bash
# 在服务器上执行
sudo nano /etc/ssh/sshd_config

# 找到以下配置行（使用 Ctrl+W 搜索）：
# PermitRootLogin yes
# PasswordAuthentication yes
# PubkeyAuthentication yes

# 修改为：
PermitRootLogin prohibit-password  # 只允许密钥登录root
PasswordAuthentication no          # 禁用密码登录
PubkeyAuthentication yes          # 启用密钥认证（通常默认已启用）

# 保存退出：
# Ctrl+X, Y, Enter
```

### 4.3 验证配置

```bash
# 检查配置是否正确
sudo grep -E "^PermitRootLogin|^PasswordAuthentication|^PubkeyAuthentication" /etc/ssh/sshd_config

# 应该看到：
# PermitRootLogin prohibit-password
# PasswordAuthentication no
# PubkeyAuthentication yes
```

### 4.4 测试配置（重要！）

```bash
# 在服务器上执行（不要关闭当前SSH连接！）
# 在另一个终端窗口测试新连接

# 在本地电脑打开新终端，执行：
ssh root@your.server.ip

# 应该可以正常登录（使用密钥）
# 如果成功，继续下一步
# 如果失败，立即回退（见下面的回退步骤）
```

---

## 第五步：重启SSH服务

### 5.1 重启SSH服务

```bash
# 在服务器上执行
sudo systemctl restart sshd

# 检查服务状态
sudo systemctl status sshd

# 应该显示：active (running)
```

### 5.2 再次测试连接

```bash
# 在本地电脑新终端执行
ssh root@your.server.ip

# 应该可以正常登录（使用密钥）
# 如果设置了密钥密码，会提示输入密钥密码
# 如果没设置密钥密码，应该直接登录成功
```

### 5.3 验证密码登录已禁用

```bash
# 在本地电脑执行（测试密码登录是否被拒绝）
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@your.server.ip

# 应该被拒绝，显示：
# Permission denied (publickey)
```

---

## 第六步：配置SSH客户端（可选，但推荐）

### 6.1 创建SSH配置文件

```bash
# 在本地电脑执行
nano ~/.ssh/config

# 添加以下内容：
Host podroom
    HostName your.server.ip
    User root
    IdentityFile ~/.ssh/id_rsa
    IdentitiesOnly yes

# 保存退出（Ctrl+X, Y, Enter）
```

### 6.2 使用简化命令登录

```bash
# 现在可以使用简化命令登录
ssh podroom

# 而不是每次都输入：
# ssh root@your.server.ip
```

---

## 回退方案（如果出现问题）

### 如果密钥登录失败，需要恢复密码登录

**方法1：通过云服务商控制台**

1. 登录阿里云控制台
2. 进入ECS实例
3. 点击"远程连接" → "VNC"
4. 在VNC中执行：

```bash
# 恢复SSH配置
sudo cp /etc/ssh/sshd_config.backup.* /etc/ssh/sshd_config

# 或手动编辑
sudo nano /etc/ssh/sshd_config
# 改回：
# PermitRootLogin yes
# PasswordAuthentication yes

# 重启SSH
sudo systemctl restart sshd
```

**方法2：如果有其他SSH连接**

```bash
# 在另一个SSH连接中执行回退操作
# （如果当前连接还没断开）
```

---

## 验证清单

执行以下命令，确认所有配置正确：

```bash
# 1. 密钥登录正常
ssh root@your.server.ip
# ✅ 应该可以登录（使用密钥）

# 2. 密码登录已禁用
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@your.server.ip
# ✅ 应该被拒绝

# 3. 服务器SSH配置正确
ssh root@your.server.ip "grep -E '^PermitRootLogin|^PasswordAuthentication' /etc/ssh/sshd_config"
# ✅ 应该显示：
# PermitRootLogin prohibit-password
# PasswordAuthentication no

# 4. Fail2ban仍然运行
ssh root@your.server.ip "sudo systemctl is-active fail2ban"
# ✅ 应该显示：active
```

---

## 常见问题

### Q1: 每次登录都要输入密钥密码，很麻烦

**A**: 可以使用SSH agent缓存密码：

```bash
# 在本地电脑执行
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa

# 输入一次密钥密码后，在当前会话中就不需要再输入了
# 可以添加到 ~/.bashrc 或 ~/.zshrc 自动启动
```

### Q2: 如何在多个设备使用同一个密钥？

**A**: 将私钥复制到其他设备（注意安全）：

```bash
# 在本地电脑执行
# 将私钥和公钥复制到其他设备
scp ~/.ssh/id_rsa ~/.ssh/id_rsa.pub user@other-device:~/.ssh/

# 在其他设备上设置权限
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
```

### Q3: 如何添加多个密钥？

**A**: 在服务器上添加多个公钥：

```bash
# 在服务器上执行
nano ~/.ssh/authorized_keys

# 每行一个公钥，保存退出
```

### Q4: 如何更改密钥密码？

**A**: 

```bash
# 在本地电脑执行
ssh-keygen -p -f ~/.ssh/id_rsa

# 输入旧密码，然后输入新密码
```

---

## 完成标志

✅ 所有步骤完成后，你应该：

1. ✅ 可以使用 `ssh root@your.server.ip` 直接登录（无需输入root密码）
2. ✅ 密码登录已被禁用
3. ✅ Fail2ban仍然运行
4. ✅ 防火墙仍然启用

---

## 安全提示

1. **妥善保管私钥**：`~/.ssh/id_rsa` 是你的私钥，不要泄露给他人
2. **设置密钥密码**：即使私钥泄露，也需要密码才能使用
3. **定期更换密钥**：建议每年更换一次
4. **备份密钥**：将私钥备份到安全的地方（加密存储）

---

## 下一步

配置完成后，建议：

1. ✅ 更改root密码（虽然已禁用密码登录，但密码仍可能在其他地方使用）
2. ✅ 定期检查SSH登录日志：`grep "Accepted publickey" /var/log/auth.log`
3. ✅ 考虑更改SSH端口（进一步降低被扫描概率）

