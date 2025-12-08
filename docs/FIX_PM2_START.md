# 修复PM2启动问题

## 问题
PM2启动命令语法错误，`--port 3005` 被错误解析为目录路径

## 解决方案

### 方案1：修改package.json（已修复）

已经修改了 `package.json`，dev脚本现在包含端口：
```json
"dev": "next dev --turbopack --port 3005"
```

### 方案2：使用正确的PM2命令

```bash
# 停止当前进程
pm2 delete podroom

# 使用环境变量方式启动
cd /opt/podroom
PORT=3005 pm2 start pnpm --name podroom -- run dev

# 或使用PM2的ecosystem配置（如果已配置）
pm2 start ecosystem.config.js
```

### 方案3：直接使用npm/pnpm命令

```bash
# 停止PM2进程
pm2 delete podroom

# 直接启动（前台运行，用于测试）
cd /opt/podroom
pnpm run dev

# 或后台运行
nohup pnpm run dev > /dev/null 2>&1 &
```

## 推荐操作

1. 先提交修改后的package.json到GitHub
2. 在服务器上拉取最新代码
3. 使用正确的命令启动

