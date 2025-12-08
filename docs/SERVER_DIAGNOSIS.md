# 服务器问题诊断指南

在重置服务器之前，先进行诊断，可能能找到问题并快速解决。

---

## 第一步：检查系统资源

### 1. 检查内存使用情况

```bash
# 查看内存和swap使用
free -h

# 应该关注：
# - Mem available: 至少500MB可用
# - Swap total: 应该有2GB（如果之前配置过）
# - Swap used: 如果使用率很高，说明内存不足
```

**如果内存不足**：
```bash
# 检查哪些进程占用内存最多
ps aux --sort=-%mem | head -15

# 停止不必要的服务
systemctl list-units --type=service --state=running
# 可以停止的服务（如果不需要）：
# systemctl stop fwupd      # 固件更新服务
# systemctl stop tuned       # 系统调优服务
# systemctl stop unattended-upgrades  # 自动更新服务
```

### 2. 检查磁盘空间

```bash
# 查看磁盘使用情况
df -h

# 检查根目录使用情况
du -h --max-depth=1 / | sort -hr | head -10

# 如果磁盘空间不足，清理：
# 清理apt缓存
apt clean
apt autoremove -y

# 清理日志文件
journalctl --vacuum-time=7d  # 只保留7天日志

# 清理临时文件
rm -rf /tmp/*
rm -rf /var/tmp/*
```

### 3. 检查CPU使用情况

```bash
# 查看CPU使用情况
top -bn1 | head -20

# 或者使用htop（如果安装了）
htop

# 检查是否有进程占用大量CPU
ps aux --sort=-%cpu | head -15
```

---

## 第二步：检查Node.js和构建环境

### 1. 检查Node.js版本

```bash
node --version
npm --version
pnpm --version

# 如果版本不对，可能需要重新安装
# Node.js应该是20.x
# pnpm应该是10.x
```

### 2. 检查构建工具

```bash
# 检查是否有构建工具
which gcc
which make
gcc --version

# 如果没有，安装：
apt install -y build-essential
```

### 3. 检查npm/pnpm缓存

```bash
# 检查npm缓存大小
npm cache verify

# 清理npm缓存
npm cache clean --force

# 检查pnpm存储
pnpm store prune

# 清理pnpm缓存
rm -rf ~/.pnpm-store
```

---

## 第三步：检查系统服务

### 1. 检查是否有其他Node.js进程

```bash
# 查找所有node进程
ps aux | grep -E "node|next|npm|pnpm" | grep -v grep

# 如果有不需要的进程，停止它们
# kill -9 <PID>
```

### 2. 检查PM2状态

```bash
# 查看PM2进程
pm2 list

# 查看PM2日志
pm2 logs --lines 50

# 如果有问题，清理PM2
pm2 delete all
pm2 kill
```

### 3. 检查系统服务

```bash
# 查看运行中的服务
systemctl list-units --type=service --state=running

# 检查是否有异常服务
systemctl status
```

---

## 第四步：检查网络和端口

### 1. 检查端口占用

```bash
# 检查3005端口是否被占用
netstat -tlnp | grep 3005
# 或
lsof -i :3005

# 如果被占用，找到进程并停止
```

### 2. 检查防火墙

```bash
# 检查防火墙状态
ufw status
# 或
iptables -L

# 如果需要，开放端口
ufw allow 3005/tcp
```

---

## 第五步：检查构建相关的问题

### 1. 检查Next.js构建配置

```bash
cd /opt/podroom

# 检查next.config.ts
cat next.config.ts

# 检查package.json
cat package.json | grep -A 5 "scripts"
```

### 2. 检查依赖完整性

```bash
cd /opt/podroom

# 检查node_modules是否完整
ls -la node_modules | head -20

# 重新安装依赖（如果可能有问题）
rm -rf node_modules
rm -rf pnpm-lock.yaml  # 注意：这会删除锁文件
pnpm install
```

### 3. 检查环境变量

```bash
cd /opt/podroom

# 检查.env文件是否存在
ls -la .env

# 检查关键环境变量
grep -E "DATABASE_URL|QWEN_API_KEY|NEXT_PUBLIC" .env
```

---

## 第六步：尝试修复常见问题

### 问题1：内存不足

**解决方案**：
```bash
# 1. 添加swap空间（如果还没有）
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 2. 清理系统缓存
sync
echo 3 > /proc/sys/vm/drop_caches

# 3. 使用限制内存的方式构建
NODE_OPTIONS='--max-old-space-size=1536' pnpm build
```

### 问题2：磁盘空间不足

**解决方案**：
```bash
# 1. 清理apt缓存
apt clean
apt autoremove -y

# 2. 清理日志
journalctl --vacuum-time=3d

# 3. 清理Docker（如果安装了）
docker system prune -a

# 4. 清理旧的构建文件
cd /opt/podroom
rm -rf .next
rm -rf node_modules/.cache
```

### 问题3：构建卡住

**诊断**：
```bash
# 1. 检查是否有构建进程在运行
ps aux | grep -E "next|build" | grep -v grep

# 2. 检查内存使用（构建时）
watch -n 2 'free -h'

# 3. 检查swap使用
swapon --show
```

**解决方案**：
```bash
# 1. 如果构建卡住，中断并尝试开发模式
# Ctrl+C 中断构建

# 2. 使用开发模式（不需要完整构建）
pm2 start pnpm --name podroom -- run dev

# 3. 或者使用更小的内存限制
NODE_OPTIONS='--max-old-space-size=1024' pnpm build
```

### 问题4：依赖问题

**解决方案**：
```bash
cd /opt/podroom

# 1. 清理并重新安装
rm -rf node_modules
rm -rf .next
pnpm install --frozen-lockfile

# 2. 如果还有问题，更新依赖
pnpm update

# 3. 检查是否有冲突
pnpm list --depth=0
```

---

## 第七步：系统级检查

### 1. 检查系统更新

```bash
# 检查是否有待更新的包
apt list --upgradable

# 检查系统版本
lsb_release -a

# 检查内核版本
uname -r
```

### 2. 检查系统日志

```bash
# 查看系统日志
journalctl -n 100

# 查看错误日志
journalctl -p err -n 50

# 查看系统启动日志
journalctl -b
```

### 3. 检查磁盘I/O性能

```bash
# 安装iostat（如果还没有）
apt install -y sysstat

# 检查磁盘I/O
iostat -x 1 5

# 如果I/O等待很高，可能是磁盘问题
```

---

## 第八步：尝试修复后的构建

完成诊断和修复后，尝试重新构建：

```bash
cd /opt/podroom

# 1. 清理所有缓存
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo

# 2. 检查资源
free -h
df -h

# 3. 使用限制内存的方式构建
NODE_OPTIONS='--max-old-space-size=2048' pnpm build

# 4. 如果构建成功，启动应用
pm2 start ecosystem.config.js --env production

# 5. 如果构建失败，使用开发模式
pm2 start pnpm --name podroom -- run dev
```

---

## 诊断检查清单

在决定是否重置服务器之前，检查以下项目：

- [ ] 内存使用情况（`free -h`）
- [ ] Swap空间是否启用（`swapon --show`）
- [ ] 磁盘空间是否充足（`df -h`）
- [ ] 是否有其他进程占用资源（`ps aux --sort=-%mem`）
- [ ] Node.js和pnpm版本是否正确
- [ ] 依赖是否完整（`pnpm install`）
- [ ] 环境变量是否正确配置
- [ ] 系统日志是否有错误（`journalctl -p err`）
- [ ] 构建进程是否真的卡住（`ps aux | grep build`）

---

## 何时应该重置服务器？

如果以下情况都满足，建议重置：

1. ✅ 内存和swap都已优化，但构建还是卡住
2. ✅ 磁盘空间充足，但构建还是失败
3. ✅ 依赖已重新安装，但问题依然存在
4. ✅ 系统日志显示无法修复的错误
5. ✅ 诊断时间已经超过重置+部署的时间

**重置的优势**：
- 环境干净，避免未知问题
- 可以确保所有配置正确
- 通常比长时间诊断更快

**重置的劣势**：
- 需要重新配置环境
- 可能需要重新安装依赖
- 需要重新配置服务

---

## 快速修复方案（如果诊断后仍无法解决）

如果诊断后问题依然存在，可以尝试：

### 方案1：使用开发模式（推荐）

```bash
cd /opt/podroom
pm2 delete all
rm -rf .next
pm2 start pnpm --name podroom -- run dev
```

开发模式不需要构建，功能相同，只是启动时按需编译。

### 方案2：在本地构建，然后上传

```bash
# 在本地（有更多资源）构建
pnpm build

# 打包.next目录
tar -czf next-build.tar.gz .next

# 上传到服务器
scp next-build.tar.gz root@your-server:/opt/podroom/

# 在服务器上解压
cd /opt/podroom
tar -xzf next-build.tar.gz

# 启动生产模式
pm2 start ecosystem.config.js --env production
```

### 方案3：使用Docker构建

如果有Docker环境：

```bash
# 在服务器上使用Docker构建
docker run --rm -v $(pwd):/app -w /app node:20 pnpm build
```

---

## 总结

诊断流程：
1. ✅ 检查系统资源（内存、磁盘、CPU）
2. ✅ 检查Node.js环境
3. ✅ 检查系统服务
4. ✅ 检查网络和端口
5. ✅ 检查构建配置
6. ✅ 尝试修复常见问题
7. ✅ 重新尝试构建

如果诊断后问题依然存在，考虑：
- 使用开发模式（最简单）
- 在本地构建后上传（如果有本地环境）
- 重置服务器（最彻底）

