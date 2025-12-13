# Certbot Standalone 403 错误修复

## 问题分析

即使使用 standalone 模式，Certbot 还是返回 403。这说明：
1. Certbot 的 standalone 服务器启动了
2. 但 Let's Encrypt 的服务器访问验证文件时被阻止（返回 403）

可能的原因：
- 防火墙或安全组阻止了访问
- 有其他进程占用 80 端口
- 阿里云的安全策略

## 解决方案

### 步骤 1: 检查 80 端口是否被占用

```bash
# 检查 80 端口
sudo lsof -i :80
sudo netstat -tlnp | grep :80

# 如果有其他进程占用，停止它
sudo systemctl stop nginx  # 如果 Nginx 还在运行
sudo systemctl stop apache2  # 如果有 Apache
```

### 步骤 2: 检查防火墙

```bash
# 检查防火墙状态
sudo ufw status

# 确保 80 端口已开放
sudo ufw allow 80/tcp
sudo ufw reload

# 检查 iptables（如果有）
sudo iptables -L -n | grep 80
```

### 步骤 3: 检查阿里云安全组

**重要**：在阿里云控制台检查安全组规则：

1. 登录阿里云控制台
2. 进入 **ECS 实例** → 选择你的实例
3. 点击 **安全组** → **配置规则**
4. 确保有以下**入站规则**：
   - **端口 80**，协议 **TCP**，源 **0.0.0.0/0**，描述 "HTTP"
   - **端口 443**，协议 **TCP**，源 **0.0.0.0/0**，描述 "HTTPS"

### 步骤 4: 测试端口是否可访问

```bash
# 在另一台机器上测试（或使用在线工具）
# 应该能够访问 http://podcasttoinsight.top

# 或者在服务器上测试本地
curl -I http://localhost/.well-known/acme-challenge/test
```

### 步骤 5: 使用 DNS 验证方式（备用方案）

如果 HTTP 验证一直失败，可以使用 DNS 验证：

```bash
# 使用 DNS 验证
sudo certbot certonly --manual --preferred-challenges dns -d podcasttoinsight.top -d www.podcasttoinsight.top
```

这会要求你在域名 DNS 中添加 TXT 记录。

### 步骤 6: 检查是否有 Web 应用防火墙（WAF）

如果使用了阿里云的 WAF 或其他安全服务，可能会拦截 Let's Encrypt 的请求。需要：
1. 在 WAF 中添加白名单：`/.well-known/acme-challenge/*`
2. 或者暂时关闭 WAF 进行验证

## 推荐操作顺序

1. **检查阿里云安全组**（最重要）
2. 检查防火墙
3. 确保 80 端口没有被占用
4. 如果还是不行，使用 DNS 验证

