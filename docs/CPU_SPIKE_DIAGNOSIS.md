# CPU飙升诊断和预防指南

## 快速诊断步骤

### 1. 立即执行诊断脚本

在服务器上执行：

```bash
cd /opt/podroom
git pull origin main
chmod +x scripts/diagnose-cpu-spike.sh
./scripts/diagnose-cpu-spike.sh
```

这个脚本会显示：
- CPU占用最高的10个进程
- 可疑进程（恶意脚本特征）
- 系统负载情况
- 网络连接情况
- 定时任务检查
- 应用进程状态（PM2、Nginx）

### 2. 手动快速检查

如果脚本无法执行，可以手动执行以下命令：

```bash
# 查看CPU占用最高的进程
ps aux --sort=-%cpu | head -11

# 检查可疑进程
ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep

# 检查网络连接
netstat -tulnp | grep ESTABLISHED | head -10

# 检查PM2进程
pm2 list
pm2 logs --lines 50

# 检查系统负载
uptime
```

### 3. 根据诊断结果处理

#### 情况A：发现可疑进程（恶意脚本）

```bash
# 1. 记录进程PID
ps aux | grep -E "\.update|\.sh|miner|mine|xmrig|weball|12323" | grep -v grep

# 2. 终止进程
kill -9 <PID>

# 3. 删除可疑文件
rm -f /usr/bin/.update
rm -f /tmp/x.sh /tmp/f
rm -f /tmp/*.sh

# 4. 检查并清理配置文件
sed -i '/\.update/d' /etc/profile /root/.bashrc
sed -i '/while true/,/done &/d' /etc/profile /root/.bashrc

# 5. 清理定时任务
crontab -l | grep -vE "weball|12323|\.update" | crontab -
```

#### 情况B：应用进程占用高（PM2/Next.js）

```bash
# 1. 查看应用日志
pm2 logs --lines 100

# 2. 检查是否有异常请求
# 查看Nginx访问日志
tail -f /var/log/nginx/access.log

# 3. 检查数据库连接
# 如果数据库查询慢，可能导致CPU高

# 4. 重启应用（如果必要）
pm2 restart all
```

#### 情况C：系统进程占用高

```bash
# 1. 查看进程详细信息
ps -p <PID> -o pid,ppid,user,cmd,%cpu,%mem,etime

# 2. 查看进程树
pstree -p <PID>

# 3. 检查进程日志
journalctl -u <service-name> --since "1 hour ago"
```

---

## 预防措施

### 1. 设置自动监控

执行以下命令设置自动监控：

```bash
cd /opt/podroom
git pull origin main
chmod +x scripts/setup-cpu-monitoring.sh
./scripts/setup-cpu-monitoring.sh
```

这将设置：
- **CPU监控**：每5分钟检查一次，超过95%会记录日志
- **历史记录**：每小时记录一次CPU使用率
- **自动清理**：每天凌晨3点自动清理可疑进程和文件

### 2. 加强安全防护

#### 安装Fail2ban（防止暴力破解）

```bash
# 安装
sudo apt-get update
sudo apt-get install -y fail2ban

# 配置
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 检查状态
sudo fail2ban-client status
```

#### 更改SSH端口（可选）

```bash
# 编辑SSH配置
sudo nano /etc/ssh/sshd_config

# 修改端口（例如改为2222）
Port 2222

# 重启SSH服务
sudo systemctl restart sshd
```

#### 禁用root密码登录（推荐使用密钥）

```bash
# 编辑SSH配置
sudo nano /etc/ssh/sshd_config

# 设置
PermitRootLogin no
PasswordAuthentication no  # 如果已配置SSH密钥

# 重启SSH服务
sudo systemctl restart sshd
```

### 3. 定期安全检查

创建定期安全检查脚本：

```bash
# 每天执行一次安全检查
0 2 * * * /opt/podroom/scripts/verify-security-status.sh
```

### 4. 资源限制

#### 限制进程CPU使用（使用systemd）

如果某个服务经常占用高CPU，可以设置CPU限制：

```bash
# 编辑服务文件
sudo systemctl edit <service-name>

# 添加CPU限制（例如限制为50%）
[Service]
CPUQuota=50%
```

#### 使用cgroup限制（高级）

```bash
# 安装cgroup工具
sudo apt-get install -y cgroup-tools

# 创建CPU限制组
sudo cgcreate -g cpu:/cpu-limit
sudo cgset -r cpu.cfs_quota_us=50000 cpu-limit  # 限制为50%
```

### 5. 应用层优化

#### 检查慢查询

```bash
# 如果使用PostgreSQL
# 启用慢查询日志
# 检查数据库连接池配置
```

#### 优化缓存

- 确保Redis缓存正常工作
- 检查缓存命中率
- 调整缓存TTL

#### 限制并发请求

在Nginx中设置：

```nginx
# 限制每个IP的连接数
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
limit_conn conn_limit_per_ip 10;

# 限制请求速率
limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=10r/s;
limit_req zone=req_limit_per_ip burst=20 nodelay;
```

---

## 监控和告警

### 1. 查看监控日志

```bash
# CPU监控日志
tail -f /opt/podroom/logs/cpu-monitor.log

# CPU历史记录
cat /opt/podroom/logs/cpu-history.csv

# 自动清理日志
tail -f /opt/podroom/logs/auto-cleanup.log
```

### 2. 设置告警（可选）

可以配置邮件或Slack通知，在CPU持续高时发送告警。

---

## 常见原因总结

### 1. 恶意脚本/挖矿程序
- **特征**：进程名包含`.update`, `.sh`, `miner`, `xmrig`等
- **处理**：立即终止进程，删除文件，清理配置

### 2. 应用异常
- **特征**：PM2进程占用高，日志中有错误
- **处理**：查看应用日志，检查数据库连接，重启应用

### 3. 系统资源不足
- **特征**：内存不足，磁盘IO高
- **处理**：检查`free -h`和`df -h`，清理空间

### 4. 数据库查询慢
- **特征**：数据库连接数高，查询时间长
- **处理**：优化查询，添加索引，检查慢查询日志

### 5. 大量并发请求
- **特征**：Nginx访问日志中有大量请求
- **处理**：设置限流，检查是否有DDoS攻击

---

## 紧急处理流程

如果CPU持续100%，按以下顺序处理：

1. **立即诊断**
   ```bash
   ./scripts/diagnose-cpu-spike.sh
   ```

2. **如果是恶意进程**
   - 终止进程：`kill -9 <PID>`
   - 删除文件：`rm -f /usr/bin/.update /tmp/*.sh`
   - 清理配置：修复`/etc/profile`和`/root/.bashrc`

3. **如果是应用问题**
   - 查看日志：`pm2 logs`
   - 重启应用：`pm2 restart all`
   - 检查数据库：查看连接数和慢查询

4. **设置监控**
   - 执行：`./scripts/setup-cpu-monitoring.sh`
   - 确保自动监控和清理已启用

5. **加强安全**
   - 安装Fail2ban
   - 更改SSH配置
   - 定期安全检查

---

## 后续维护

1. **每天检查**：查看监控日志，确认无异常
2. **每周检查**：查看CPU历史记录，分析趋势
3. **每月检查**：执行完整的安全检查
4. **及时更新**：保持系统和应用更新

---

## 相关文档

- `scripts/diagnose-cpu-spike.sh` - CPU诊断脚本
- `scripts/setup-cpu-monitoring.sh` - 监控设置脚本
- `scripts/verify-security-status.sh` - 安全检查脚本
- `docs/SECURITY_STATUS_SUMMARY.md` - 安全状态总结

