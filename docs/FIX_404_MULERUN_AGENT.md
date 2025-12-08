# 修复 /mulerun/agent 404 错误

## 问题
`https://podcasttoinsight.top/mulerun/agent` 显示 404 Not Found

## 原因
服务器上的代码可能没有更新，或者Next.js应用没有重新构建/重启

## 解决方案

### 方法1：确保代码已更新并重新构建（推荐）

在服务器上执行：

```bash
# 1. 进入项目目录
cd /opt/podroom

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖（如果有新依赖）
npm install  # 或 pnpm install

# 4. 生成Prisma客户端（如果schema有变化）
npx prisma generate

# 5. 重新构建Next.js应用
npm run build  # 或 pnpm build

# 6. 重启应用
pm2 restart podroom
# 或
pm2 restart all
```

### 方法2：检查文件是否存在

```bash
# 检查文件是否存在
ls -la src/app/mulerun/agent/page.tsx

# 如果文件不存在，说明代码没有更新
git pull origin main
```

### 方法3：检查Next.js路由

```bash
# 查看Next.js构建输出
pm2 logs podroom | grep -i "mulerun\|agent\|404"

# 或查看完整日志
pm2 logs podroom --lines 100
```

### 方法4：直接测试路由

```bash
# 在服务器上测试
curl http://localhost:3005/mulerun/agent

# 如果返回404，说明路由不存在
# 如果返回内容，说明路由存在，可能是Nginx配置问题
```

## 快速修复命令（复制粘贴）

```bash
cd /opt/podroom
git pull origin main
npm install
npx prisma generate
npm run build
pm2 restart podroom
```

## 验证修复

修复后，在浏览器访问：
- `https://podcasttoinsight.top/mulerun/agent`

应该看到MuleRun Agent页面（即使没有MuleRun参数，也应该显示"参数缺失"的提示，而不是404）

