# 🚀 播客应用部署指南

## 📋 部署方案

### 方案一：Git + 自动化部署（推荐）
- ✅ 支持版本控制
- ✅ 自动备份和回滚
- ✅ 健康检查
- ✅ 零停机部署

### 方案二：Docker部署
- ✅ 环境一致性
- ✅ 容器化隔离
- ✅ 易于扩展

## 🛠️ 服务器准备

### 1. 系统要求
```bash
# Ubuntu 20.04+ / CentOS 8+
# Node.js 20+
# pnpm 8+
# PM2
# Nginx
# PostgreSQL
```

### 2. 安装必要软件
```bash
# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装pnpm
npm install -g pnpm

# 安装PM2
npm install -g pm2

# 安装Nginx
sudo apt-get install nginx

# 安装PostgreSQL
sudo apt-get install postgresql postgresql-contrib
```

## 🚀 部署步骤

### 1. 首次部署
```bash
# 1. 克隆仓库
git clone https://github.com/your-username/podroom.git /opt/podroom
cd /opt/podroom

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入生产环境配置

# 3. 安装依赖
pnpm install

# 4. 生成Prisma客户端
pnpm prisma generate

# 5. 构建应用
pnpm build

# 6. 启动应用
pm2 start ecosystem.config.js --env production

# 7. 保存PM2配置
pm2 save
pm2 startup
```

### 2. 日常更新

#### 快速更新（小改动）
```bash
./scripts/quick-update.sh
```

#### 完整部署（大改动）
```bash
./scripts/deploy.sh production main
```

#### 回滚到之前版本
```bash
# 查看可用备份
./scripts/rollback.sh

# 回滚到指定备份
./scripts/rollback.sh backup-20241020-143022
```

## 🔧 配置说明

### 1. 环境变量配置
```bash
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/podroom"

# 认证配置
AUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://yourdomain.com"

# AI服务配置
QWEN_API_KEY="your-qwen-api-key"
ALIYUN_ASR_ACCESS_KEY_ID="your-access-key"
ALIYUN_ASR_ACCESS_KEY_SECRET="your-secret-key"

# 文件存储配置
ALIYUN_OSS_ACCESS_KEY_ID="your-oss-access-key"
ALIYUN_OSS_ACCESS_KEY_SECRET="your-oss-secret-key"
ALIYUN_OSS_BUCKET="your-bucket-name"
ALIYUN_OSS_REGION="your-region"
```

### 2. Nginx配置
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 监控和维护

### 1. 应用状态监控
```bash
# 查看应用状态
pm2 status

# 查看应用日志
pm2 logs podroom

# 查看实时日志
pm2 logs podroom --lines 100

# 重启应用
pm2 restart podroom

# 停止应用
pm2 stop podroom
```

### 2. 健康检查
```bash
# 检查应用健康状态
curl http://localhost:3000/api/health

# 检查数据库连接
curl http://localhost:3000/api/health | jq '.status'
```

### 3. 日志管理
```bash
# 查看错误日志
tail -f /var/log/podroom/err.log

# 查看输出日志
tail -f /var/log/podroom/out.log

# 查看合并日志
tail -f /var/log/podroom/combined.log
```

## 🔄 更新流程

### 开发环境更新
1. 在本地进行开发和测试
2. 提交代码到Git仓库
3. 推送到main分支

### 生产环境更新
1. **自动更新**（推荐）：
   - 推送代码到GitHub
   - GitHub Actions自动部署

2. **手动更新**：
   ```bash
   # 快速更新
   ./scripts/quick-update.sh
   
   # 完整部署
   ./scripts/deploy.sh production main
   ```

### 回滚流程
1. 查看可用备份：`./scripts/rollback.sh`
2. 选择要回滚的备份
3. 执行回滚：`./scripts/rollback.sh backup-name`

## 🚨 故障排除

### 常见问题

1. **应用启动失败**
   ```bash
   # 检查日志
   pm2 logs podroom
   
   # 检查端口占用
   netstat -tlnp | grep 3000
   ```

2. **数据库连接失败**
   ```bash
   # 检查数据库状态
   sudo systemctl status postgresql
   
   # 检查连接字符串
   echo $DATABASE_URL
   ```

3. **内存不足**
   ```bash
   # 查看内存使用
   free -h
   
   # 重启应用
   pm2 restart podroom
   ```

## 📈 性能优化

### 1. 数据库优化
- 定期清理日志表
- 优化查询索引
- 配置连接池

### 2. 应用优化
- 启用Gzip压缩
- 配置CDN
- 优化静态资源

### 3. 监控设置
- 设置内存告警
- 配置CPU监控
- 设置磁盘空间告警

## 🔐 安全建议

1. **服务器安全**
   - 定期更新系统
   - 配置防火墙
   - 使用SSH密钥认证

2. **应用安全**
   - 定期更新依赖
   - 配置HTTPS
   - 设置访问限制

3. **数据安全**
   - 定期备份数据库
   - 加密敏感数据
   - 监控访问日志



