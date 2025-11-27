# 🚀 部署前检查清单

## ✅ 已完成的修改

1. **每日上传限制调整**：从5个改为2个
   - ✅ 后端限制配置 (`src/server/user-limits.ts`)
   - ✅ API限制检查 (`src/app/api/user/daily-usage/route.ts`, `src/app/api/process-audio-async/route.ts`)
   - ✅ 前端文案更新 (`src/app/home/page.tsx`, `src/components/*.tsx`, `src/app/register/page.tsx`)

2. **TypeScript编译错误修复**
   - ✅ `src/server/audio-processor.ts` - 修复speaker类型
   - ✅ `src/server/task-queue.ts` - 修复nextTask类型

3. **播客元数据补充**
   - ✅ 增强解析器提取作者和发布时间
   - ✅ 补充存量播客的元数据

4. **报告生成优化**
   - ✅ 添加原话摘录功能（Markdown引用格式）
   - ✅ 优化提示词，要求包含原话摘录

## 📋 部署前必须检查的事项

### 1. 环境变量配置

确保服务器上的 `.env` 文件包含以下必需变量：

```bash
# 数据库配置（必需）
DATABASE_URL="postgresql://..."

# NextAuth配置（必需）
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-domain.com"  # 生产环境URL

# 通义千问API（必需）
QWEN_API_KEY="..."

# 阿里云OSS配置（必需，用于音频存储）
ALIYUN_ACCESS_KEY_ID="..."
ALIYUN_ACCESS_KEY_SECRET="..."
ALIYUN_OSS_REGION="oss-cn-hangzhou"  # 注意：需要oss-前缀
ALIYUN_OSS_BUCKET="..."

# Next.js公共URL（必需，用于代理和内部API调用）
NEXT_PUBLIC_BASE_URL="https://your-domain.com"  # 生产环境URL

# 端口配置（可选，默认3000）
PORT=3010  # 根据ecosystem.config.js配置
```

### 2. 数据库迁移

**重要**：当前数据库未使用Prisma Migrate管理，使用 `prisma db push` 同步schema。

部署前执行：
```bash
# 在服务器上执行
cd /opt/podroom
npx prisma generate
npx prisma db push
```

**注意**：`reportOutline` 字段已添加到schema，确保数据库中有此字段。

### 3. PM2配置检查

- ✅ `ecosystem.config.js` 已配置
- ✅ 工作目录：`/opt/podroom`
- ✅ 端口：`3010`
- ✅ 日志目录：`/var/log/podroom/`（确保目录存在）

**部署前执行**：
```bash
# 创建日志目录
sudo mkdir -p /var/log/podroom
sudo chown $USER:$USER /var/log/podroom
```

### 4. 构建验证

✅ 本地构建已通过（`npm run build` 成功）

### 5. 代码质量

- ⚠️ 有一些ESLint警告（未使用的变量），不影响运行
- ✅ 无TypeScript编译错误

### 6. 功能验证清单

部署后需要验证：
- [ ] 用户注册/登录功能
- [ ] 播客上传功能（每日限制2个）
- [ ] 播客处理流程（ASR + 报告生成）
- [ ] 报告包含原话摘录（Markdown引用格式）
- [ ] 前端显示作者和发布时间
- [ ] 报告大纲显示（如果使用两轮生成）

### 7. 服务器资源检查

- [ ] 磁盘空间充足（音频文件存储）
- [ ] 内存充足（建议至少2GB）
- [ ] 网络连接正常（访问外部API）

### 8. 依赖安装

确保服务器已安装：
- Node.js 20+
- pnpm 或 npm
- PM2
- PostgreSQL客户端（如果需要）

## 🚨 潜在问题

1. **环境变量不一致**：
   - `ALIYUN_ACCESS_KEY_ID` vs `ALIYUN_OSS_ACCESS_KEY_ID`
   - 代码中使用 `ALIYUN_ACCESS_KEY_ID`，但 `env.example` 中分开列出
   - **建议**：统一使用 `ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET`

2. **NEXT_PUBLIC_BASE_URL**：
   - 确保生产环境设置为实际域名
   - 用于内部API代理调用

3. **数据库连接**：
   - 确保 `DATABASE_URL` 正确
   - 确保数据库可访问（网络、防火墙）

4. **OSS配置**：
   - 确保 `ALIYUN_OSS_REGION` 格式正确（如：`oss-cn-hangzhou`）
   - 代码会自动添加 `oss-` 前缀，但建议直接使用完整格式

## 📝 部署步骤建议

1. **备份当前版本**
   ```bash
   cd /opt/podroom
   cp -r . ../podroom-backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **更新代码**
   ```bash
   git pull  # 或上传新代码
   ```

3. **安装依赖**
   ```bash
   pnpm install  # 或 npm install
   ```

4. **生成Prisma客户端**
   ```bash
   npx prisma generate
   ```

5. **同步数据库schema**
   ```bash
   npx prisma db push
   ```

6. **构建应用**
   ```bash
   npm run build
   ```

7. **重启应用**
   ```bash
   pm2 restart podroom
   # 或
   pm2 stop podroom
   pm2 start ecosystem.config.js --env production
   ```

8. **验证部署**
   ```bash
   # 检查应用状态
   pm2 status
   pm2 logs podroom --lines 50
   
   # 检查健康状态
   curl http://localhost:3010/api/health
   ```

## 🔍 部署后验证

1. 访问首页，检查是否正常加载
2. 测试播客上传（验证每日限制2个）
3. 检查处理流程是否正常
4. 验证报告是否包含原话摘录
5. 检查前端是否显示作者和发布时间




