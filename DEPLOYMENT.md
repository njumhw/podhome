# 阿里云服务器部署指南

## 🚀 部署步骤

### 1. 服务器准备
```bash
# 连接到你的阿里云服务器
ssh root@your-server-ip

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装pnpm
npm install -g pnpm

# 安装PM2
npm install -g pm2

# 安装Nginx
sudo apt install nginx -y
```

### 2. 项目部署
```bash
# 克隆项目（或上传代码）
git clone https://github.com/your-username/podroom.git
cd podroom

# 复制环境变量
cp env.production.example .env.production
# 编辑 .env.production 填入实际配置

# 给部署脚本执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

### 3. 配置Nginx
```bash
# 复制Nginx配置
sudo cp nginx.conf /etc/nginx/sites-available/podroom
sudo ln -s /etc/nginx/sites-available/podroom /etc/nginx/sites-enabled/

# 删除默认配置
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

### 4. 配置SSL证书（Let's Encrypt）
```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 设置自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 5. 数据库配置
如果使用本地PostgreSQL：
```bash
# 安装PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# 创建数据库和用户
sudo -u postgres psql
CREATE DATABASE podroom;
CREATE USER podroom_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE podroom TO podroom_user;
\q

# 运行数据库迁移
pnpm prisma migrate deploy
```

## 🔧 常用命令

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs podroom

# 重启应用
pm2 restart podroom

# 停止应用
pm2 stop podroom

# 查看Nginx状态
sudo systemctl status nginx

# 查看Nginx日志
sudo tail -f /var/log/nginx/error.log
```

## 🛡️ 安全建议

1. **防火墙配置**
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

2. **定期备份**
```bash
# 创建备份脚本
#!/bin/bash
pg_dump podroom > backup_$(date +%Y%m%d_%H%M%S).sql
```

3. **监控设置**
- 使用PM2监控
- 设置日志轮转
- 配置告警通知

## 📊 性能优化

1. **Nginx缓存**
2. **PM2集群模式**
3. **数据库连接池**
4. **CDN加速**

## 🚨 故障排除

1. **应用无法启动**
   - 检查环境变量
   - 查看PM2日志
   - 确认端口占用

2. **数据库连接失败**
   - 检查DATABASE_URL
   - 确认数据库服务状态
   - 验证网络连接

3. **Nginx 502错误**
   - 检查应用是否运行
   - 查看Nginx错误日志
   - 确认代理配置
