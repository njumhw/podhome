# 播客智能处理系统

一个基于 AI 的播客内容处理平台，支持自动转录、智能总结和角色识别。

## 功能特性

- 🎙️ **智能转录**: 支持多种播客平台链接，自动提取音频并转录
- 🤖 **AI 总结**: 基于通义千问生成详细的播客总结
- 👥 **角色识别**: 自动识别主持人、嘉宾等角色
- 📱 **响应式设计**: 支持桌面和移动端访问
- 🔐 **用户系统**: 支持注册、登录和权限管理
- ⚡ **异步处理**: 支持长时间播客的后台处理

## 技术栈

- **前端**: Next.js 15, React, TypeScript, Tailwind CSS
- **后端**: Next.js API Routes, Prisma ORM
- **数据库**: PostgreSQL (Supabase)
- **AI 服务**: 通义千问 (Qwen)
- **语音识别**: 阿里云 ASR
- **文件存储**: 阿里云 OSS
- **部署**: Vercel

## 本地开发

### 环境要求

- Node.js 18+
- pnpm
- PostgreSQL 数据库

### 安装依赖

```bash
pnpm install
```

### 环境配置

复制 `env.example` 为 `.env.local` 并配置相关环境变量：

```bash
cp env.example .env.local
```

### 数据库设置

```bash
# 生成 Prisma 客户端
pnpm prisma generate

# 推送数据库模式
pnpm prisma db push
```

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

### 环境变量配置

在 Vercel 项目设置中配置以下环境变量：

- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `NEXTAUTH_SECRET`: NextAuth 密钥
- `NEXTAUTH_URL`: 应用 URL
- `QWEN_API_KEY`: 通义千问 API 密钥
- `ALIYUN_ASR_ACCESS_KEY_ID`: 阿里云 ASR Access Key ID
- `ALIYUN_ASR_ACCESS_KEY_SECRET`: 阿里云 ASR Access Key Secret
- `ALIYUN_OSS_ACCESS_KEY_ID`: 阿里云 OSS Access Key ID
- `ALIYUN_OSS_ACCESS_KEY_SECRET`: 阿里云 OSS Access Key Secret
- `ALIYUN_OSS_BUCKET`: 阿里云 OSS 存储桶名称
- `ALIYUN_OSS_REGION`: 阿里云 OSS 区域

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── admin/             # 管理后台
│   ├── home/              # 首页
│   └── podcast/           # 播客详情页
├── components/            # React 组件
├── clients/               # 外部服务客户端
├── server/                # 服务器端工具
└── utils/                 # 工具函数
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License