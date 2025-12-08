# 清理磁盘空间指南

## 问题
磁盘空间严重不足：40GB中已使用37GB，只剩663MB（99%使用率）

## 清理步骤

### 1. 清理Docker（如果有）
```bash
docker system prune -a --volumes
```

### 2. 清理系统日志
```bash
# 清理系统日志
journalctl --vacuum-time=7d  # 只保留7天日志

# 或清理到只剩100MB
journalctl --vacuum-size=100M
```

### 3. 清理包管理器缓存
```bash
# 清理apt缓存
sudo apt clean
sudo apt autoremove

# 清理pnpm缓存（如果使用pnpm）
pnpm store prune
```

### 4. 清理Next.js构建缓存
```bash
cd /opt/podroom

# 清理.next目录（如果构建失败）
rm -rf .next

# 清理node_modules缓存
rm -rf node_modules/.cache
```

### 5. 清理npm/pnpm缓存
```bash
# npm缓存
npm cache clean --force

# pnpm缓存
pnpm store prune
```

### 6. 查找大文件
```bash
# 查找大于100MB的文件
find / -type f -size +100M 2>/dev/null | head -20

# 查找大目录
du -h --max-depth=1 / 2>/dev/null | sort -hr | head -20
```

### 7. 清理临时文件
```bash
# 清理/tmp
rm -rf /tmp/*

# 清理系统临时文件
rm -rf /var/tmp/*
```

## 快速清理命令（按顺序执行）

```bash
# 1. 清理系统日志
sudo journalctl --vacuum-size=100M

# 2. 清理apt缓存
sudo apt clean
sudo apt autoremove

# 3. 清理npm/pnpm缓存
cd /opt/podroom
npm cache clean --force
# 或
pnpm store prune

# 4. 清理构建缓存
rm -rf .next
rm -rf node_modules/.cache

# 5. 检查空间
df -h
```

## 目标
清理后至少要有2-3GB的可用空间，才能正常构建。

