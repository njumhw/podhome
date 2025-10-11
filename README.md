# PodHome

极简的播客转写、总结与跨播客 QA 应用。

## 技术栈
- Next.js (App Router, TypeScript)
- TailwindCSS + shadcn/ui（后续接入）
- Postgres（开发使用 Supabase，支持 pgvector）
- 向量检索：pgvector
- AI：阿里云 ASR、通义千问（文本 & 向量）

## 本地开发
```bash
cp .env.example .env
pnpm install
pnpm db:push
# 首次向量列与索引初始化
node -e "import('./dist/server/vector.js').then(m=>m.ensureVectorSetup())"
pnpm dev
```

## Docker 运行
```bash
# 构建镜像
docker build -t podroom:local .
# 运行
docker run --env-file ./.env -p 3000:3000 podroom:local
```

## 环境变量说明
见 `.env.example`。所有敏感信息必须通过环境变量管理，不得硬编码。

## 认证与权限
- 注册 `POST /api/auth/register`（需邀请码）
- 登录 `POST /api/auth/login`
- 退出 `POST /api/auth/logout`
- 游客可浏览内容；上传 `/api/upload` 与 QA `/api/qa` 需登录

## 管理后台（API）
- 邀请码创建 `POST /api/admin/invite/create`
- 主题审核 `POST /api/admin/topics/pending`、`POST /api/admin/topics/approve`
- 用户管理 `GET/PATCH /api/admin/users`
- 任务重跑 `POST /api/pipeline/run`
- 成本统计 `GET /api/admin/cost`
均需 `adminSecret`。

## 部署
- 多阶段 Dockerfile，使用 Next.js standalone 输出
- 运行时读取 `process.env`，无需在镜像内打包密钥

## 目录结构
- `src/app`: 页面与路由
- `src/components`: 复用组件
- `src/features`: 业务功能模块
- `src/stores`: 状态管理
- `src/utils`: 工具（包含环境变量校验、HTTP 错误工具）

## 约定
- 使用 pnpm 管理依赖
- 严禁将 `.env` 提交到仓库，提交 `.env.example`
