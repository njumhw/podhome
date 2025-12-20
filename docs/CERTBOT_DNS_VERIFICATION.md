# 使用 DNS 验证获取 SSL 证书

## 为什么使用 DNS 验证？

- ✅ 不需要开放 80 端口
- ✅ 不受防火墙和安全组限制
- ✅ 最可靠的方式
- ✅ 适合所有网络环境

## 步骤

### 步骤1：启动 DNS 验证

```bash
certbot certonly --manual --preferred-challenges dns -d podcasttoinsight.top -d www.podcasttoinsight.top
```

**按提示操作**：
1. 输入邮箱：`njumwh@163.com`
2. 同意服务条款：输入 `Y`
3. 是否分享邮箱：输入 `Y` 或 `N`（可选）

### 步骤2：Certbot 会显示需要添加的 DNS TXT 记录

Certbot 会显示类似以下内容：

```
Please deploy a DNS TXT record under the name:
_acme-challenge.podcasttoinsight.top

with the following value:

WGVr4ijuBU149EIzcD_fobr87fyb9AiprBvQt-GnLHw

Before continuing, verify the record is deployed.
```

**重要**：Certbot 会显示两个 TXT 记录，一个是 `_acme-challenge.podcasttoinsight.top`，另一个是 `_acme-challenge.www.podcasttoinsight.top`。

### 步骤3：在阿里云 DNS 控制台添加 TXT 记录

1. 登录阿里云控制台：https://dns.console.aliyun.com
2. 找到域名 **podcasttoinsight.top**
3. 点击 **"解析设置"**
4. 点击 **"添加记录"**

**添加第一个 TXT 记录**：
- **记录类型**：`TXT`
- **主机记录**：`_acme-challenge`
- **记录值**：Certbot 显示的第一个值（例如：`WGVr4ijuBU149EIzcD_fobr87fyb9AiprBvQt-GnLHw`）
- **TTL**：`600`（或默认）

**添加第二个 TXT 记录**（如果 Certbot 显示了）：
- **记录类型**：`TXT`
- **主机记录**：`_acme-challenge.www`
- **记录值**：Certbot 显示的第二个值
- **TTL**：`600`（或默认）

5. 点击 **"确认"** 保存

### 步骤4：等待 DNS 传播（1-2分钟）

```bash
# 验证 DNS 记录是否已生效
dig TXT _acme-challenge.podcasttoinsight.top +short
dig TXT _acme-challenge.www.podcasttoinsight.top +short
```

**预期输出**：应该返回 Certbot 显示的值

**如果返回空**，等待 1-2 分钟后再试。

### 步骤5：在 Certbot 终端按 Enter 继续

当 DNS 记录验证成功后，在 Certbot 终端按 **Enter** 继续验证。

**如果成功**，应该看到：
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/podcasttoinsight.top/privkey.pem
```

### 步骤6：配置 Nginx HTTPS

```bash
nano /etc/nginx/sites-available/podroom
```

**完整配置**：

```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name podcasttoinsight.top www.podcasttoinsight.top;
    return 301 https://$server_name$request_uri;
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name podcasttoinsight.top www.podcasttoinsight.top;

    # SSL 证书路径
    ssl_certificate /etc/letsencrypt/live/podcasttoinsight.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/podcasttoinsight.top/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:3005;
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

保存：`Ctrl+O` → `Enter` → `Ctrl+X`

### 步骤7：测试并重新加载 Nginx

```bash
nginx -t
systemctl reload nginx
```

### 步骤8：验证 HTTPS

```bash
# 测试 HTTPS
curl -I https://podcasttoinsight.top/home

# 应该返回 200 OK
```

---

## 重要提示

1. **DNS 记录值**：Certbot 每次运行都会生成新的值，必须使用 Certbot **当前显示**的值，不能使用之前的值。

2. **等待 DNS 传播**：添加 DNS 记录后，通常需要 1-2 分钟才能在全球生效。使用 `dig` 命令验证。

3. **两个域名**：如果 Certbot 显示了两个 TXT 记录（主域名和 www），两个都要添加。

4. **删除旧记录**：如果之前添加过 TXT 记录，先删除旧的，再添加新的。

---

## 如果 DNS 验证也失败

检查：
1. DNS 记录是否正确添加
2. 主机记录是否正确（`_acme-challenge` 或 `_acme-challenge.www`）
3. 记录值是否与 Certbot 显示的一致
4. 是否等待了足够的时间让 DNS 传播

