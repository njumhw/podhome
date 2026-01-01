# 删除恶意脚本 /usr/bin/.update

## 问题确认

从 `/etc/profile` 第30-45行可以看到：
- 有两个 `while true` 循环
- 都在尝试执行 `/usr/bin/.update` 文件（已被删除）
- 每30秒执行一次，在后台运行
- **这是恶意脚本！**

## 立即修复

### 步骤1：查看完整的恶意代码范围

```bash
# 查看更大的范围，找到完整的代码块
sed -n '25,50p' /etc/profile
```

### 步骤2：删除恶意代码

```bash
# 方法1：直接删除包含 .update 的所有行
sed -i '/\.update/d' /etc/profile

# 方法2：删除包含 while true 和 .update 的整个代码块
# 先查看行号
grep -n "while true\|\.update" /etc/profile

# 然后删除这些行（假设是25-45行）
sed -i '25,45d' /etc/profile
```

### 步骤3：检查修复结果

```bash
# 检查语法
bash -n /etc/profile

# 查看修复后的内容
sed -n '25,35p' /etc/profile
```

### 步骤4：检查并修复 /root/.bashrc

```bash
# 检查是否有类似问题
grep -n "\.update\|while true" /root/.bashrc

# 如果有，删除
sed -i '/\.update/d' /root/.bashrc
sed -i '/while true.*\.update/d' /root/.bashrc
```

### 步骤5：检查其他配置文件

```bash
# 检查其他可能被感染的配置文件
grep -r "\.update" /etc/profile.d/ 2>/dev/null
grep -r "\.update" /etc/bash.bashrc 2>/dev/null
grep -r "\.update" /etc/bashrc 2>/dev/null
```

## 安全检查

### 检查是否有其他恶意脚本

```bash
# 1. 检查所有定时任务
crontab -l
cat /etc/crontab | grep -v "^#"
ls -la /etc/cron.d/
ls -la /etc/cron.hourly/
ls -la /etc/cron.daily/
ls -la /etc/cron.weekly/
ls -la /etc/cron.monthly/

# 2. 检查系统服务
systemctl list-units --type=service | grep -E "update|\.sh"

# 3. 检查可疑进程
ps aux | grep -E "\.update|\.sh.*update" | grep -v grep

# 4. 检查网络连接
netstat -tulnp | grep ESTABLISHED

# 5. 检查最近修改的文件
find /usr/bin -name ".*" -type f -mtime -30 2>/dev/null
find /tmp -name ".*" -type f -mtime -7 2>/dev/null
```

## 快速修复命令（一键执行）

```bash
# 1. 备份
cp /etc/profile /etc/profile.backup.$(date +%Y%m%d_%H%M%S)

# 2. 删除所有包含 .update 的行
sed -i '/\.update/d' /etc/profile

# 3. 删除所有包含 "while true" 和 "startup &" 的恶意循环
sed -i '/while true/,/done &/d' /etc/profile

# 4. 检查语法
bash -n /etc/profile

# 5. 检查 .bashrc
sed -i '/\.update/d' /root/.bashrc 2>/dev/null

# 6. 重新加载
source /etc/profile
```

