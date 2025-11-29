# GitHub 推送连接问题解决方案

## 问题描述
```
fatal: unable to access 'https://github.com/njumhw/podhome.git/': 
Failed to connect to github.com port 443 after 75004 ms: Couldn't connect to server
```

这是网络连接问题，无法通过 HTTPS 连接到 GitHub。

## 解决方案

### 方案1: 使用 SSH 方式（推荐）

如果已配置 SSH 密钥，可以改用 SSH 方式：

```bash
cd /Users/maoweihao/cursor/Ear/podroom

# 1. 更改远程 URL 为 SSH
git remote set-url origin git@github.com:njumhw/podhome.git

# 2. 验证更改
git remote -v

# 3. 测试 SSH 连接
ssh -T git@github.com

# 4. 推送
git push origin main
```

### 方案2: 配置代理（如果需要）

如果使用代理访问 GitHub：

```bash
# 设置 HTTP 代理（根据你的代理配置修改）
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 或者只对 GitHub 设置代理
git config --global http.https://github.com.proxy http://127.0.0.1:7890
git config --global https.https://github.com.proxy http://127.0.0.1:7890

# 然后重试推送
git push origin main
```

### 方案3: 检查网络连接

```bash
# 测试 GitHub 连接
ping github.com

# 测试 HTTPS 连接
curl -I https://github.com

# 如果都失败，可能是网络问题或需要配置代理
```

### 方案4: 增加超时时间

```bash
# 增加 Git 超时时间
git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

# 重试推送
git push origin main
```

### 方案5: 使用 GitHub CLI（如果已安装）

```bash
# 如果安装了 gh CLI
gh auth login
git push origin main
```

## 当前状态

✅ 代码已成功提交到本地：
- Commit: `171aee2`
- 16 files changed, 399 insertions(+), 82 deletions(-)
- 包含的文件：
  - PUSH_TO_GITHUB.md
  - docs/CODE_REVIEW_SUMMARY.md
  - src/components/UserStatusBadge.tsx
  - 以及其他修改的文件

## 推荐操作

1. **首先尝试方案1（SSH方式）**，这是最可靠的
2. 如果 SSH 未配置，可以：
   - 配置 SSH 密钥（推荐）
   - 或使用方案2配置代理
3. 推送成功后，代码就会同步到 GitHub

## 验证推送成功

推送成功后，可以在 GitHub 查看：
- https://github.com/njumhw/podhome/commits/main

