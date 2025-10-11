# PodHome 部署指南

## 前置条件
- Node.js 20+
- pnpm 10+
- Postgres（建议 Supabase 开发环境）
- 已配置 `.env`（参考 `.env.example`）

## 环境变量
请根据 `.env.example` 填写。注意：
- 不要将 `.env` 提交到仓库
- 线上/本地分别维护独立 `.env`

## 本地运行
```bash
cp .env.example .env
pnpm install
pnpm db:push
pnpm prisma:generate
pnpm dev
```

## Docker 部署
```bash
docker build -t podroom:latest .
docker run --env-file ./.env -p 3000:3000 podroom:latest
```

## 服务器部署（pm2）
```bash
# 上传代码并进入目录
./deploy.sh
# 若安装了 pm2，自动以进程守护方式运行
```

## 数据库与向量检索
- 使用 Prisma 管理 schema
- 生产中请启用 pgvector 扩展并将 `TranscriptChunk.embedding` 列替换为 `@db.Vector(<dims>)`
- 初期可先使用占位 embedding 以验证功能

## 常见问题
- 构建时 sharp/oxide 等被忽略：执行 `pnpm approve-builds` 选择允许运行构建脚本的依赖
- Prisma 无法连接数据库：检查 `DATABASE_URL` 与网络访问策略
