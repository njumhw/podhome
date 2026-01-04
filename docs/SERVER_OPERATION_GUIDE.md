# 服务器日常操作指南

## 登录方式选择

### ✅ 推荐：使用Mac终端SSH登录

**优点**：
- ✅ 更快速：直接连接，无需打开浏览器
- ✅ 更便捷：可以在本地终端直接操作
- ✅ 更安全：使用SSH密钥，无需输入密码
- ✅ 支持本地工具：可以使用scp、rsync等工具
- ✅ 支持SSH配置：可以配置简化命令

**适用场景**：
- 日常操作（拉取代码、部署、重启服务等）
- 查看日志、调试问题
- 文件传输（scp、rsync）
- 所有常规服务器操作

### ⚠️ 备用：使用阿里云控制台Workbench

**适用场景**：
- SSH无法连接时（网络问题、配置错误等）
- 需要图形界面操作
- 紧急故障排查
- 首次配置或恢复配置

**注意**：
- Workbench密码登录可能无法使用（因为已禁用密码登录）
- 可以使用"救援登录"或"Workbench一键连接"（如果配置了）

---

## 日常操作流程

### 1. 登录服务器

```bash
# 在Mac终端执行
ssh root@47.117.77.211

# 或者如果配置了简化命令（见下面的配置）
ssh podroom
```

### 2. 拉取代码

```bash
# 登录服务器后
cd /opt/podroom
git pull origin main

# 如果需要解决冲突
git status
git add .
git commit -m "解决冲突"
git push origin main
```

### 3. 重新部署

```bash
# 登录服务器后
cd /opt/podroom

# 安装依赖（如果需要）
npm install
# 或
pnpm install

# 构建项目（如果需要）
npm run build

# 重启应用
pm2 restart all

# 或重启特定应用
pm2 restart podroom

# 查看状态
pm2 list
pm2 logs --lines 50
```

### 4. 查看日志

```bash
# 应用日志
pm2 logs --lines 100
pm2 logs podroom --lines 100

# Nginx日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 系统日志
journalctl -u ssh -n 50
journalctl -u nginx -n 50

# 安全检查日志
tail -f /opt/podroom/logs/security-check.log

# CPU监控日志
tail -f /opt/podroom/logs/cpu-monitor.log
```

### 5. 检查服务状态

```bash
# PM2状态
pm2 list
pm2 status

# Nginx状态
systemctl status nginx
systemctl is-active nginx

# 系统资源
uptime
free -h
df -h
```

### 6. 文件传输

```bash
# 从Mac上传文件到服务器
scp /path/to/local/file root@47.117.77.211:/opt/podroom/

# 从服务器下载文件到Mac
scp root@47.117.77.211:/opt/podroom/file /path/to/local/

# 上传整个目录
scp -r /path/to/local/dir root@47.117.77.211:/opt/podroom/

# 使用rsync（更高效，支持断点续传）
rsync -avz /path/to/local/ root@47.117.77.211:/opt/podroom/
```

---

## 配置SSH简化命令（推荐）

### 在Mac上配置

```bash
# 编辑SSH配置文件
nano ~/.ssh/config

# 添加以下内容：
Host podroom
    HostName 47.117.77.211
    User root
    IdentityFile ~/.ssh/id_rsa
    IdentitiesOnly yes

# 保存退出：Ctrl+X, Y, Enter
```

### 使用简化命令

```bash
# 现在可以使用简化命令登录
ssh podroom

# 而不是每次都输入：
# ssh root@47.117.77.211
```

---

## 常用操作命令速查

### 代码管理

```bash
# 拉取最新代码
cd /opt/podroom && git pull origin main

# 查看代码状态
git status
git log --oneline -10

# 解决冲突
git add .
git commit -m "解决冲突"
git push origin main
```

### 应用管理

```bash
# 重启应用
pm2 restart all
pm2 restart podroom

# 停止应用
pm2 stop podroom

# 启动应用
pm2 start podroom

# 查看应用状态
pm2 list
pm2 show podroom

# 查看应用日志
pm2 logs podroom --lines 100
pm2 logs --lines 100 --nostream
```

### 服务管理

```bash
# Nginx
sudo systemctl restart nginx
sudo systemctl status nginx
sudo nginx -t  # 测试配置

# SSH
sudo systemctl restart ssh
sudo systemctl status ssh

# Fail2ban
sudo fail2ban-client status sshd
sudo fail2ban-client status
```

### 系统检查

```bash
# 系统资源
uptime
free -h
df -h
ps aux --sort=-%cpu | head -10

# 网络连接
netstat -tulnp | grep ESTABLISHED
ss -tulnp | grep ESTABLISHED

# 安全检查
/opt/podroom/scripts/check-security-status.sh
tail -f /opt/podroom/logs/security-check.log
```

---

## 完整部署流程示例

### 场景：代码更新后重新部署

```bash
# 1. 登录服务器
ssh podroom  # 或 ssh root@47.117.77.211

# 2. 进入项目目录
cd /opt/podroom

# 3. 拉取最新代码
git pull origin main

# 4. 检查是否有冲突
git status

# 5. 安装依赖（如果需要）
npm install
# 或
pnpm install

# 6. 构建项目（如果需要）
npm run build

# 7. 重启应用
pm2 restart podroom

# 8. 检查应用状态
pm2 list
pm2 logs podroom --lines 50

# 9. 检查Nginx（如果需要）
sudo systemctl status nginx

# 10. 测试访问
curl http://localhost:3000  # 根据你的应用端口调整

# 11. 退出
exit
```

---

## 故障排查流程

### 如果SSH无法连接

1. **检查网络连接**
   ```bash
   # 在Mac上
   ping 47.117.77.211
   ```

2. **检查VPN IP是否变化**
   - 如果VPN IP变化，可能需要更新安全组规则
   - 或者保持安全组规则为 `0.0.0.0/0`（已配置SSH密钥后是安全的）

3. **使用阿里云控制台VNC**
   - 登录阿里云控制台
   - ECS → 实例 → 远程连接 → VNC
   - 在VNC中检查SSH服务状态

4. **检查SSH服务**
   ```bash
   # 在VNC中
   systemctl status ssh
   systemctl restart ssh
   ```

### 如果应用无法访问

1. **检查应用状态**
   ```bash
   pm2 list
   pm2 logs podroom --lines 100
   ```

2. **检查Nginx状态**
   ```bash
   systemctl status nginx
   tail -50 /var/log/nginx/error.log
   ```

3. **检查端口监听**
   ```bash
   netstat -tulnp | grep :80
   netstat -tulnp | grep :3000  # 根据你的应用端口
   ```

4. **检查防火墙**
   ```bash
   ufw status
   ```

---

## 安全注意事项

### ✅ 已配置的安全措施

- SSH密钥认证（无需密码）
- 密码登录已禁用
- Fail2ban保护
- 防火墙已启用
- 自动监控和检查

### ⚠️ 注意事项

1. **妥善保管私钥**
   - `~/.ssh/id_rsa` 是你的私钥，不要泄露
   - 建议设置密钥密码保护

2. **定期检查日志**
   ```bash
   # 查看SSH登录记录
   grep "Accepted publickey" /var/log/auth.log | tail -20
   
   # 查看异常登录
   grep "Failed" /var/log/auth.log | tail -20
   ```

3. **定期更新系统**
   ```bash
   apt update
   apt upgrade -y
   ```

4. **定期备份**
   - 代码已通过Git管理
   - 数据库需要定期备份（如果有）

---

## 快速参考

### 登录
```bash
ssh podroom  # 如果配置了简化命令
# 或
ssh root@47.117.77.211
```

### 常用操作
```bash
# 拉取代码
cd /opt/podroom && git pull origin main

# 重启应用
pm2 restart podroom

# 查看日志
pm2 logs podroom --lines 100

# 检查状态
pm2 list
systemctl status nginx
```

### 文件传输
```bash
# 上传
scp file root@47.117.77.211:/opt/podroom/

# 下载
scp root@47.117.77.211:/opt/podroom/file ./
```

---

## 总结

**推荐流程**：
1. ✅ **日常操作**：使用Mac终端SSH登录（`ssh podroom`）
2. ⚠️ **紧急情况**：使用阿里云控制台VNC

**优势**：
- 更快速、更便捷
- 支持本地工具和脚本
- 可以配置简化命令
- 安全性已保障（SSH密钥）

现在你可以直接在Mac终端使用 `ssh root@47.117.77.211` 或配置后的 `ssh podroom` 登录服务器进行操作了！

