# 阿里云服务器 Git 拉取 GitHub 代码稳定方案

## 🔍 问题分析

从错误信息看：
```
fatal: unable to access 'https://github.com/njumhw/podhome.git/': 
Failed to connect to github.com port 443 after 135332 ms: Couldn't connect to server
```

这是典型的**网络连接超时问题**，在中国大陆访问 GitHub 经常遇到。

## ✅ 解决方案（按推荐顺序）

### 方案 1：配置 Git 使用代理（最稳定，推荐）

如果服务器有代理可用：

#### 1.1 设置 HTTP/HTTPS 代理

```bash
# 临时设置（当前会话有效）
export http_proxy=http://proxy.example.com:8080
export https_proxy=http://proxy.example.com:8080

# 或者只针对 Git
git config --global http.proxy http://proxy.example.com:8080
git config --global https.proxy http://proxy.example.com:8080
```

#### 1.2 如果使用 SOCKS5 代理

```bash
git config --global http.proxy socks5://127.0.0.1:1080
git config --global https.proxy socks5://127.0.0.1:1080
```

#### 1.3 只对 GitHub 使用代理

```bash
git config --global http.https://github.com.proxy socks5://127.0.0.1:1080
git config --global https.https://github.com.proxy socks5://127.0.0.1:1080
```

#### 1.4 查看当前代理配置

```bash
git config --global --get http.proxy
git config --global --get https.proxy
```

#### 1.5 取消代理（如果需要）

```bash
git config --global --unset http.proxy
git config --global --unset https.proxy
```

---

### 方案 2：使用 SSH 代替 HTTPS（推荐）

SSH 连接通常比 HTTPS 更稳定：

#### 2.1 检查是否已有 SSH 密钥

```bash
ls -al ~/.ssh
```

#### 2.2 如果没有，生成 SSH 密钥

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# 按 Enter 使用默认路径
# 设置密码（可选）
```

#### 2.3 复制公钥

```bash
cat ~/.ssh/id_ed25519.pub
```

#### 2.4 添加到 GitHub

1. 访问：https://github.com/settings/keys
2. 点击 **New SSH key**
3. 粘贴公钥
4. 保存

#### 2.5 在服务器上修改远程仓库 URL

```bash
cd /opt/podroom
git remote set-url origin git@github.com:njumhw/podhome.git
git remote -v  # 验证
```

#### 2.6 测试 SSH 连接

```bash
ssh -T git@github.com
# 应该看到：Hi njumhw! You've successfully authenticated...
```

---

### 方案 3：增加 Git 超时和重试配置

```bash
# 增加超时时间（秒）
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

# 增加连接超时
git config --global http.postBuffer 524288000

# 启用 HTTP/1.1（有时更稳定）
git config --global http.version HTTP/1.1
```

---

### 方案 4：使用 GitHub 镜像（临时方案）

#### 4.1 使用 fastgit.org 镜像

```bash
cd /opt/podroom
git remote set-url origin https://hub.fastgit.xyz/njumhw/podhome.git
```

#### 4.2 使用 ghproxy.com 代理

```bash
cd /opt/podroom
git remote set-url origin https://ghproxy.com/https://github.com/njumhw/podhome.git
```

**注意**：镜像服务可能不稳定，建议仅作临时使用。

---

### 方案 5：创建自动重试脚本（最实用）

创建一个带重试机制的拉取脚本：

```bash
#!/bin/bash
# 文件：/opt/podroom/update.sh

cd /opt/podroom

MAX_RETRIES=5
RETRY_DELAY=10

for i in $(seq 1 $MAX_RETRIES); do
    echo "尝试拉取代码 (第 $i 次)..."
    
    if git fetch origin && git reset --hard origin/main && git clean -fd; then
        echo "✅ 代码拉取成功！"
        exit 0
    else
        echo "❌ 拉取失败，等待 ${RETRY_DELAY} 秒后重试..."
        sleep $RETRY_DELAY
    fi
done

echo "❌ 所有重试都失败了"
exit 1
```

使用：

```bash
chmod +x /opt/podroom/update.sh
/opt/podroom/update.sh
```

---

### 方案 6：使用 Gitee 镜像（长期方案）

如果 GitHub 访问持续不稳定，可以考虑：

1. **在 Gitee 创建镜像仓库**
   - 访问：https://gitee.com
   - 导入 GitHub 仓库
   - 设置自动同步

2. **在服务器上使用 Gitee**

```bash
cd /opt/podroom
git remote set-url origin https://gitee.com/njumhw/podhome.git
```

---

## 🚀 推荐配置（综合方案）

结合多种方案，创建一个稳定的部署脚本：

```bash
#!/bin/bash
# 文件：/opt/podroom/deploy.sh

set -e  # 遇到错误立即退出

cd /opt/podroom

# 配置 Git（如果还没有）
git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

# 停止服务
echo "停止服务..."
pm2 stop podroom || true

# 拉取代码（带重试）
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
    echo "尝试拉取代码 (第 $i/$MAX_RETRIES 次)..."
    
    if git fetch origin && git reset --hard origin/main && git clean -fd; then
        echo "✅ 代码拉取成功！"
        break
    else
        if [ $i -eq $MAX_RETRIES ]; then
            echo "❌ 所有重试都失败了"
            exit 1
        fi
        echo "等待 ${RETRY_DELAY} 秒后重试..."
        sleep $RETRY_DELAY
    fi
done

# 安装依赖（如果需要）
if [ -f "package.json" ]; then
    echo "安装依赖..."
    npm install --production || pnpm install --production || yarn install --production
fi

# 构建（如果需要）
if [ -f "package.json" ] && grep -q '"build"' package.json; then
    echo "构建项目..."
    npm run build || pnpm build || yarn build
fi

# 数据库迁移（如果需要）
if [ -f "prisma/schema.prisma" ]; then
    echo "同步数据库..."
    npx prisma generate
    npx prisma db push || true
fi

# 重启服务
echo "重启服务..."
pm2 restart podroom || pm2 start podroom

echo "✅ 部署完成！"
pm2 status
```

使用：

```bash
chmod +x /opt/podroom/deploy.sh
/opt/podroom/deploy.sh
```

---

## 🔧 快速修复（立即执行）

在服务器上执行以下命令：

```bash
cd /opt/podroom

# 1. 配置 Git 超时
git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

# 2. 尝试使用 SSH（如果已配置 SSH 密钥）
# git remote set-url origin git@github.com:njumhw/podhome.git

# 3. 或者使用镜像（临时）
# git remote set-url origin https://ghproxy.com/https://github.com/njumhw/podhome.git

# 4. 重试拉取
git fetch origin && git reset --hard origin/main && git clean -fd
```

---

## 📋 检查清单

- [ ] 是否配置了代理？
- [ ] 是否使用 SSH 连接？
- [ ] 是否增加了 Git 超时配置？
- [ ] 是否创建了自动重试脚本？
- [ ] 是否测试了连接？

---

## 💡 最佳实践建议

1. **优先使用 SSH**：比 HTTPS 更稳定
2. **配置代理**：如果有可用的代理服务
3. **使用重试脚本**：自动处理网络波动
4. **监控连接**：定期检查 Git 连接状态
5. **备用方案**：准备 Gitee 镜像作为备用

---

**建议先尝试方案 2（SSH）或方案 1（代理），这两个最稳定！**


