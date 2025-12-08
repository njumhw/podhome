# 清理 /root 目录指南

## 问题
/root 目录占用了24GB空间，需要找出可以删除的文件

## 检查步骤

### 1. 检查 /root 目录下的大目录
```bash
du -h --max-depth=1 /root 2>/dev/null | sort -hr | head -20
```

### 2. 检查大文件
```bash
find /root -type f -size +100M 2>/dev/null | head -20
```

### 3. 检查常见的大文件类型
```bash
# 检查日志文件
find /root -name "*.log" -size +10M 2>/dev/null

# 检查压缩文件
find /root -name "*.zip" -o -name "*.tar.gz" -o -name "*.tar" 2>/dev/null

# 检查缓存文件
find /root -name "*cache*" -type d 2>/dev/null
```

## 常见可以删除的内容

1. **构建缓存和临时文件**
   - `.npm` 缓存
   - `.pnpm` 缓存
   - `.next` 构建目录（如果不在项目目录）
   - `node_modules`（如果不在项目目录）

2. **日志文件**
   - `*.log` 文件
   - 旧的错误日志

3. **下载的文件**
   - 安装包（`.deb`, `.rpm`）
   - 压缩文件（`.zip`, `.tar.gz`）

4. **Docker相关**（如果有）
   - Docker镜像
   - 容器数据

## 安全删除建议

在删除前，先确认文件用途：
```bash
# 查看文件详情
ls -lh /root/大文件路径

# 查看文件内容（如果是文本文件）
head -20 /root/文件路径
```

