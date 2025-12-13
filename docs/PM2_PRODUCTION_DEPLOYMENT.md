# PM2 生产模式部署流程

## 概述

本文档记录使用 PM2 在生产模式下部署应用的完整流程，包括环境变量加载、进程管理和故障排查。

## 前置条件

1. 代码已拉取到服务器 `/opt/podroom`
2. 依赖已安装：`pnpm install --frozen-lockfile`
3. Prisma 已生成：`npx prisma generate`
4. 数据库已同步：`npx prisma db push`
5. 应用已构建：`NODE_OPTIONS='--max-old-space-size=1536' pnpm build`
6. `.env` 文件已配置在 `/opt/podroom/.env`

## 核心文件：ecosystem.config.js

### 创建 ecosystem.config.js

在 `/opt/podroom` 目录下创建 `ecosystem.config.js` 文件：

```bash
cd /opt/podroom

cat > ecosystem.config.js << 'EOF'
const fs = require('fs');
const path = require('path');

// 手动读取 .env 文件
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      // 忽略注释和空行
      if (line && !line.startsWith('#')) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, ''); // 移除引号
          env[key] = value;
        }
      }
    });
  }
  
  return env;
}

const envVars = loadEnvFile();

module.exports = {
  apps: [{
    name: 'podroom',
    script: 'npm',
    args: 'start',
    cwd: '/opt/podroom',
    env: {
      NODE_ENV: 'production',
      PORT: 3005,
      ...envVars  // 从 .env 文件加载所有环境变量
    }
  }]
}
EOF
```

**重要说明：**
- 此文件使用 Node.js 内置模块（`fs`、`path`），不依赖 `dotenv`
- 自动读取 `.env` 文件并加载所有环境变量
- 忽略注释行（以 `#` 开头）和空行
- 自动移除值两端的引号

## 部署流程

### 1. 停止现有进程

```bash
cd /opt/podroom

# 停止并删除现有 PM2 进程
pm2 stop podroom
pm2 delete podroom
```

### 2. 清理所有冲突进程

```bash
# 检查是否有其他 PM2 实例在运行
ps aux | grep pm2

# 如果有多个 PM2 守护进程，停止它们
pm2 kill

# 检查是否有其他 Node.js 进程占用端口
ps aux | grep node
netstat -tlnp | grep :3005

# 如果有，停止它们
pkill -f "next start"
pkill -f "next-server"
```

### 3. 确认端口已释放

```bash
# 检查端口 3005 是否被占用
netstat -tlnp | grep :3005

# 应该没有输出，说明端口已释放
```

### 4. 确保 ecosystem.config.js 存在

```bash
# 检查文件是否存在
ls -la ecosystem.config.js

# 如果不存在，按照上面的方法创建
```

### 5. 启动应用

```bash
cd /opt/podroom

# 使用 ecosystem.config.js 启动
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save
```

### 6. 验证部署

```bash
# 检查 PM2 进程状态
pm2 list

# 应该看到 podroom 进程状态为 "online"，uptime 大于 0

# 检查端口监听
netstat -tlnp | grep :3005

# 应该看到 next-server 进程在监听 3005

# 检查环境变量（重要）
pm2 env 0 | grep MULERUN_AGENT_KEY

# 应该能看到 MULERUN_AGENT_KEY 的值

# 查看日志
pm2 logs podroom --lines 20

# 应该没有端口冲突或其他错误
```

## 代码更新后的重新部署流程

### 完整流程（推荐）

```bash
cd /opt/podroom

# 1. 停止应用
pm2 stop podroom

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖（如果需要）
pnpm install --frozen-lockfile

# 4. 生成 Prisma（如果需要）
npx prisma generate

# 5. 同步数据库（如果需要）
npx prisma db push

# 6. 构建应用
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 7. 重启应用
pm2 restart podroom

# 8. 保存配置
pm2 save

# 9. 验证
pm2 list
pm2 logs podroom --lines 20
pm2 env 0 | grep MULERUN_AGENT_KEY
```

### 快速流程（仅代码更新，无依赖变更）

```bash
cd /opt/podroom

# 1. 停止应用
pm2 stop podroom

# 2. 拉取最新代码
git pull origin main

# 3. 构建应用
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 4. 重启应用
pm2 restart podroom

# 5. 保存配置
pm2 save

# 6. 验证
pm2 list
pm2 logs podroom --lines 20
```

## 常见问题排查

### 问题 1：端口冲突（EADDRINUSE）

**症状：**
- PM2 日志显示 `Error: listen EADDRINUSE: address already in use :::3005`
- 进程频繁重启（uptime 很短，restart 次数很高）

**解决方法：**
```bash
# 1. 检查是否有进程在监听 3005
netstat -tlnp | grep :3005

# 2. 停止所有相关进程
pm2 stop all
pm2 delete all
pkill -f "next start"
pkill -f "next-server"

# 3. 检查是否有多个 PM2 守护进程
ps aux | grep pm2

# 4. 如果有多个，停止它们
pm2 kill

# 5. 确认端口已释放
netstat -tlnp | grep :3005

# 6. 重新启动
pm2 start ecosystem.config.js
```

### 问题 2：环境变量未加载

**症状：**
- `pm2 env 0 | grep MULERUN_AGENT_KEY` 没有输出
- 应用启动时无法读取环境变量

**解决方法：**
```bash
# 1. 检查 ecosystem.config.js 是否存在
ls -la ecosystem.config.js

# 2. 检查 .env 文件是否存在
ls -la .env

# 3. 检查 ecosystem.config.js 内容是否正确
cat ecosystem.config.js

# 4. 重新创建 ecosystem.config.js（使用上面的模板）

# 5. 重启应用
pm2 stop podroom
pm2 delete podroom
pm2 start ecosystem.config.js
pm2 save

# 6. 验证环境变量
pm2 env 0 | grep MULERUN_AGENT_KEY
```

### 问题 3：多个 PM2 实例冲突

**症状：**
- `pm2 list` 显示为空，但应用仍在运行
- 有多个 PM2 守护进程在运行

**解决方法：**
```bash
# 1. 检查所有 PM2 守护进程
ps aux | grep pm2

# 2. 查看不同 PM2_HOME 的进程
PM2_HOME=/root/.pm2 pm2 list
PM2_HOME=/tmp/.pm2 pm2 list

# 3. 停止所有 PM2 守护进程
pm2 kill

# 4. 确认所有进程已停止
ps aux | grep pm2
ps aux | grep node

# 5. 重新启动（使用统一的 PM2_HOME）
export PM2_HOME=/root/.pm2
pm2 start ecosystem.config.js
pm2 save
```

### 问题 4：构建失败（内存不足）

**症状：**
- `pnpm build` 失败，服务器无响应

**解决方法：**
```bash
# 1. 限制 Node.js 内存使用
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 2. 如果还是失败，进一步降低
NODE_OPTIONS='--max-old-space-size=1024' pnpm build

# 3. 检查服务器内存
free -h

# 4. 如果内存不足，考虑添加 swap 空间
```

## 重要注意事项

1. **始终使用 ecosystem.config.js**：不要直接使用 `pm2 start npm -- start`，因为这样不会加载 `.env` 文件中的环境变量。

2. **PM2_HOME 统一**：确保所有操作都使用同一个 PM2_HOME（默认是 `/root/.pm2`）。

3. **环境变量验证**：每次部署后都要验证环境变量是否正确加载，特别是 `MULERUN_AGENT_KEY`。

4. **端口检查**：部署前确保端口 3005 已释放，避免端口冲突。

5. **日志监控**：部署后查看日志，确保没有错误。

6. **保存配置**：每次修改 PM2 配置后都要执行 `pm2 save`，确保重启后配置不丢失。

## 快速参考命令

```bash
# 查看进程状态
pm2 list

# 查看日志
pm2 logs podroom --lines 50

# 查看环境变量
pm2 env 0

# 重启应用
pm2 restart podroom

# 停止应用
pm2 stop podroom

# 删除应用
pm2 delete podroom

# 保存配置
pm2 save

# 检查端口
netstat -tlnp | grep :3005

# 检查进程
ps aux | grep node
ps aux | grep pm2
```

## 更新日志

- 2025-12-13: 创建文档，记录 PM2 生产模式部署流程和环境变量加载方法

