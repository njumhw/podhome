# SSH 修复步骤（针对你的情况）

## 当前情况
- 你登录的是 `admin` 用户
- 但 SSH 配置中连接的是 `root` 用户
- 需要为 `root` 用户添加密钥

## 修复步骤

### 1. 先为 admin 用户确认密钥已添加（已完成 ✅）

```bash
# 检查 admin 用户的 authorized_keys
cat ~/.ssh/authorized_keys
```

### 2. 为 root 用户添加密钥

```bash
# 切换到 root 用户（需要 sudo 权限）
sudo su -

# 创建 root 的 .ssh 目录
mkdir -p /root/.ssh
chmod 700 /root/.ssh

# 添加你的公钥
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDfrPD9MpYsviQT3mXxkpUC9wNUKA72mPCEwJVdyUejVyzg7fN8L+xRqA07bYnIti1ZVH/XRpLh374FugsdoHoUxogv498jg36+tmZvBRhTUU8VKbmCYwuuedBXeZs8jrcV6uN3Nx0ZX14U6nc8N9npkERtszmPjmRg0A5jCoE2RqborDyPCNwNufK+WgmmQ4qzOckjjH38AZq73FKju6mpjSpQF+7Pr2QpKA2U3+ctskKLWL6bHGOyd73nO3W4HI8L153+EjplcXUItj6gc2t4hAq3LylLIP0e0m1fBOYBb9S3L8Iax5iHkv9q0arC8PtMlNUsaYsHkosg/hJ0rliiDQW4heAgetobyrX99iqkNS3NLzVezHn+qOxr4AJ2j2wT4bSNXMre5su++V1dsd1f5xJg822ivptyz/ZpUJn+q23J53m/2hL/3Hc3Z+2PMNQe/mBnEThfDJinRsN3Ou1qyIiwAMiY7Xjfq+Cg0gUgh1+62As2HygnllKKyuTMyABjk98xYM0qSincfk6TKLPgTUrtRPrr7xbiilJ7zFRfiMfVwLNauyd7hwcKXxKm4zWjEMvjzh1JB/D3yj98G04dsqshYiBoZ//VxymEg51znynjyFxmaPcERvrpv/bB6lrzTZjk3J6TkVQEfNn7Q0nu3Exz29ztja4m6ipIlpm3aw== your_email@example.com" >> /root/.ssh/authorized_keys

# 设置权限
chmod 600 /root/.ssh/authorized_keys
chown root:root /root/.ssh/authorized_keys

# 退出 root
exit
```

### 3. 验证 SSH 配置（可选）

SSH 配置中注释掉的配置会使用默认值，通常不需要修改。但如果你想确认：

```bash
# 检查 SSH 服务状态
sudo systemctl status sshd

# 如果需要重启 SSH 服务（通常不需要）
sudo systemctl restart sshd
```

### 4. 测试连接

在本地终端测试：

```bash
ssh podroom
```

## 或者：修改 SSH 配置使用 admin 用户

如果你更愿意使用 admin 用户登录，可以修改本地的 SSH 配置：

```bash
# 编辑 ~/.ssh/config
nano ~/.ssh/config

# 将 User root 改为 User admin
# 保存后测试
ssh podroom
```

