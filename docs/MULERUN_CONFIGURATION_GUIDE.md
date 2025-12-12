# MuleRun 配置完整指南

## 📋 配置步骤总结

### 步骤 1: MuleRun Creator Studio 配置

在 MuleRun Creator Studio 中填写以下信息：

| 字段 | 填写内容 | 说明 |
|------|---------|------|
| **Agent Name** | `Podcast to Insight` | 你的 Agent 名称 |
| **Import Workflow** | `Iframe` | 选择 Iframe 工作流 |
| **Start Session URL** | `https://podcasttoinsight.top/mulerun/session` | 必需，必须以 https:// 开头 |
| **Share Session URL** | `https://podcasttoinsight.top/mulerun/session` | 必需，暂时使用相同 URL |
| **Max Age** | `180` | 单位：Minutes（3 小时） |
| **Start Session Refresh Interval** | `0` | 单位：Minutes（不自动刷新） |
| **Full Screen** | `关闭（off）` | 可选 |

### 步骤 2: 获取 Agent Key

1. 在 MuleRun Creator Studio 中创建 Agent 后
2. 进入 **"3 Set Up Credentials"** 步骤
3. 复制 **Agent Key**（通常以 `mck-` 开头）
4. 保存到服务器 `.env` 文件中

### 步骤 3: 服务器环境变量配置

在服务器上编辑 `.env` 文件：

```bash
# 在服务器上执行
cd /opt/podroom
nano .env
```

添加以下配置：

```env
# MuleRun 配置
MULERUN_AGENT_KEY=mck-xxxxxxxxxxxxxxxxxxxxx  # 从 MuleRun Creator Studio 复制
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100
MULERUN_SESSION_TIMEOUT_MINUTES=180
```

保存后重启应用：

```bash
pm2 restart podroom
pm2 logs podroom --lines 50
```

### 步骤 4: 验证 HTTPS 配置

```bash
# 1. 检查 SSL 证书
sudo certbot certificates

# 2. 检查 Nginx 配置
sudo nginx -t
sudo cat /etc/nginx/sites-available/podroom | grep -A 5 "listen 443"

# 3. 测试 HTTPS 访问
curl -I https://podcasttoinsight.top/mulerun/session
```

如果返回 `200 OK` 或 `400 Bad Request`（缺少参数是正常的），说明 HTTPS 配置正确。

### 步骤 5: 验证域名解析

```bash
# 检查域名是否指向服务器 IP
nslookup podcasttoinsight.top
dig podcasttoinsight.top +short
```

确保返回的是你的服务器 IP 地址。

### 步骤 6: 测试 MuleRun 集成

1. 在 MuleRun Creator Studio 中点击 **"CREATE & NEXT"**
2. 完成后续步骤（Edit Your Agent、Set Up Credentials、Submit and Monetize）
3. 在 MuleRun 平台测试 Agent
4. 检查服务器日志：

```bash
pm2 logs podroom | grep -i mulerun
```

应该看到：
- `[MuleRun] 启动超时检测器`
- `[MuleRun] 签名验证成功`
- `[MuleRun] 创建会话成功`

## 🔍 常见问题排查

### 问题 1: HTTPS 证书不存在

**解决方案**：
```bash
sudo certbot --nginx -d podcasttoinsight.top -d www.podcasttoinsight.top
```

### 问题 2: Nginx 配置错误

**检查配置**：
```bash
sudo nginx -t
```

**查看错误日志**：
```bash
sudo tail -f /var/log/nginx/error.log
```

### 问题 3: 域名无法访问

**检查 DNS**：
```bash
nslookup podcasttoinsight.top
```

**检查防火墙**：
```bash
sudo ufw status
sudo ufw allow 443/tcp
```

**检查阿里云安全组**：
- 确保 443 端口已开放
- 确保 80 端口已开放（用于证书申请）

### 问题 4: Agent Key 错误

**检查环境变量**：
```bash
pm2 env podroom | grep MULERUN
```

**确认 Agent Key 格式**：
- 应该以 `mck-` 开头
- 长度通常为 30-40 个字符
- 不要包含引号或空格

### 问题 5: 签名验证失败

**检查日志**：
```bash
pm2 logs podroom | grep -i "签名验证失败"
```

**可能原因**：
1. Agent Key 配置错误
2. 服务器时间不同步（检查 `date` 命令）
3. URL 参数编码问题

## ✅ 验证清单

- [ ] MuleRun Creator Studio 配置完成
- [ ] Agent Key 已配置到服务器 `.env` 文件
- [ ] 服务器环境变量已加载（`pm2 env podroom`）
- [ ] HTTPS 证书有效（`certbot certificates`）
- [ ] Nginx 配置正确（`nginx -t`）
- [ ] 域名解析正确（`nslookup podcasttoinsight.top`）
- [ ] 防火墙允许 443 端口（`ufw status`）
- [ ] 阿里云安全组允许 443 端口
- [ ] 应用已重启（`pm2 restart podroom`）
- [ ] 日志显示 MuleRun 模块已启动

## 📞 需要帮助？

如果遇到问题，请提供：
1. 服务器日志（`pm2 logs podroom --lines 100`）
2. Nginx 错误日志（`sudo tail -50 /var/log/nginx/error.log`）
3. 具体的错误信息

