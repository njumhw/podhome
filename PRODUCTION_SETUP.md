# 生产环境部署配置指南

## 音频下载策略优化

已针对生产环境（阿里云服务器）优化下载策略：

### 环境检测与策略选择

- **生产环境**：优先使用代理下载（`/api/proxy-audio`），备用直接下载
  - 优势：可处理防盗链、Referer验证等限制
  - 更稳定可靠
  
- **开发环境**：优先直接下载，备用代理下载
  - 优势：速度快，适合本地开发

### 服务器地址自动检测

代码会自动检测并使用合适的服务器地址：

1. **优先级1**：`NEXT_PUBLIC_BASE_URL` 环境变量（如果已设置）
2. **优先级2**：生产环境自动使用 `127.0.0.1`（内部调用，更快更可靠）
3. **优先级3**：开发环境使用 `localhost:3000`

## 必需的环境变量配置

### 基础配置

```bash
# 必需：设置生产环境的公开访问地址
# 这是前端访问的URL，用于SSR等场景
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# 可选：服务器监听地址（默认 127.0.0.1）
# 如果使用反向代理（如 Nginx），保持默认即可
HOST=127.0.0.1

# 必需：服务器端口
PORT=3000

# 必需：Node.js 环境标识
NODE_ENV=production
```

### 数据库配置

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
```

### API 密钥配置

```bash
QWEN_API_KEY=your-qwen-api-key
ALIYUN_ACCESS_KEY_ID=your-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-access-key-secret
```

## 部署建议

### 1. 使用反向代理（推荐）

使用 Nginx 或 Caddy 作为反向代理，处理 SSL 和域名：

```nginx
# Nginx 配置示例
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 大文件上传/下载超时设置
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

### 2. 环境变量设置

**方法1：`.env.production` 文件**

在项目根目录创建 `.env.production`：

```bash
NEXT_PUBLIC_BASE_URL=https://your-domain.com
NODE_ENV=production
PORT=3000
# ... 其他配置
```

**方法2：系统环境变量**

在 PM2 ecosystem 配置或 systemd 服务文件中设置：

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'podroom',
    script: './.next/standalone/server.js',
    env: {
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: 'https://your-domain.com',
      PORT: '3000',
      // ... 其他环境变量
    }
  }]
};
```

### 3. 防火墙配置

确保以下端口开放：
- **80/443**：HTTP/HTTPS（如果使用反向代理）
- **3000**：应用端口（如果直接访问，建议使用反向代理保护）

### 4. PM2 启动脚本

```bash
# 安装依赖
pnpm install --production

# 构建应用
pnpm build

# 使用 PM2 启动
pm2 start ecosystem.config.js

# 或直接启动
NODE_ENV=production NEXT_PUBLIC_BASE_URL=https://your-domain.com pm2 start npm --name "podroom" -- start
```

## 常见问题排查

### 问题1：代理下载失败（fetch failed）

**原因**：`NEXT_PUBLIC_BASE_URL` 未设置或设置错误

**解决**：
1. 检查环境变量是否正确设置
2. 确保服务器可以通过 `127.0.0.1:3000` 或 `NEXT_PUBLIC_BASE_URL` 访问自身
3. 查看日志确认使用的下载策略

### 问题2：直接下载失败（CORS 或 403）

**原因**：音频源有防盗链保护

**解决**：
- 这是正常的，代码会自动切换到代理下载
- 确保 `proxy-audio` API 端点正常工作

### 问题3：下载速度慢

**可能原因**：
1. 服务器带宽限制
2. 音频源服务器限速
3. 代理下载增加了额外的网络跳转

**优化建议**：
- 检查服务器带宽
- 考虑使用 CDN 加速
- 在生产环境中代理下载是首选策略（可处理更多边界情况）

## 性能优化建议

1. **并发控制**：确保任务队列的并发数合理（默认3）
2. **数据库连接池**：已优化，最大连接数 20
3. **缓存策略**：音频处理结果会自动缓存，避免重复处理
4. **临时文件清理**：代码会自动清理临时文件，确保磁盘空间充足

## 监控建议

建议监控以下指标：
- 音频下载成功率
- 任务队列处理速度
- 数据库连接池使用情况
- 磁盘空间使用（临时文件目录）

## 总结

✅ **当前实现已针对生产环境优化**：
- 自动检测生产环境并使用最佳下载策略
- 智能服务器地址选择（127.0.0.1 vs localhost）
- 双重下载策略确保可靠性
- 完整的错误处理和重试机制

⚠️ **部署时必须配置**：
- `NEXT_PUBLIC_BASE_URL`（推荐设置为公网可访问的域名）
- `NODE_ENV=production`

这样就可以在阿里云服务器上稳定运行了！



