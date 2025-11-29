# GitHub 认证问题解决方案

## 🔍 问题诊断

根据错误提示，GitHub Desktop 认证失败。以下是常见的解决方案：

## ✅ 解决方案（按优先级排序）

### 方案 1：重新登录 GitHub Desktop（最简单）

1. **打开 GitHub Desktop**
2. **菜单栏** → `GitHub Desktop` → `Preferences`（或 `Settings`）
3. **Accounts** 标签页
4. **Sign Out** 当前账户
5. **Sign In** 重新登录
6. 重新尝试推送

### 方案 2：检查 GitHub Desktop 设置

1. **打开 GitHub Desktop**
2. **菜单栏** → `GitHub Desktop` → `Preferences`
3. **Git** 标签页
4. 确认 Git 配置正确：
   - Name: 你的 GitHub 用户名
   - Email: 你的 GitHub 邮箱

### 方案 3：使用 Personal Access Token（推荐）

如果使用用户名/密码认证，GitHub 已不再支持密码认证，需要使用 Personal Access Token：

#### 创建 Personal Access Token

1. 访问：https://github.com/settings/tokens
2. 点击 **Generate new token** → **Generate new token (classic)**
3. 设置：
   - **Note**: 描述用途（如 "GitHub Desktop"）
   - **Expiration**: 选择过期时间（建议 90 天或更长）
   - **Scopes**: 勾选 `repo`（完整仓库权限）
4. 点击 **Generate token**
5. **复制 token**（只显示一次，务必保存）

#### 在 GitHub Desktop 中使用 Token

1. 打开 GitHub Desktop
2. 菜单栏 → `GitHub Desktop` → `Preferences` → `Accounts`
3. 如果已登录，先 Sign Out
4. Sign In 时，如果提示输入密码，使用 **Personal Access Token** 代替密码

### 方案 4：检查仓库权限

1. 确认你有该仓库的 **写权限**（Write access）
2. 如果仓库是其他人的，需要：
   - 被添加为 Collaborator
   - 或者 Fork 到自己的账户

### 方案 5：检查仓库是否已归档

1. 访问 GitHub 仓库页面
2. 检查仓库是否显示 "Archived" 标签
3. 如果已归档，需要：
   - 联系仓库管理员取消归档
   - 或者 Fork 到自己的账户

### 方案 6：使用命令行推送（临时方案）

如果 GitHub Desktop 一直有问题，可以临时使用命令行：

```bash
cd /Users/maoweihao/cursor/Ear

# 检查远程仓库
git remote -v

# 如果使用 HTTPS，可以更新 URL 使用 Token
# git remote set-url origin https://YOUR_TOKEN@github.com/USERNAME/REPO.git

# 或者使用 SSH（如果已配置 SSH 密钥）
# git remote set-url origin git@github.com:USERNAME/REPO.git

# 推送
git push origin main
# 或
git push origin master
```

### 方案 7：配置 SSH 认证（长期方案）

如果经常遇到认证问题，建议使用 SSH：

#### 1. 检查是否已有 SSH 密钥

```bash
ls -al ~/.ssh
```

#### 2. 如果没有，生成新的 SSH 密钥

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# 按 Enter 使用默认路径
# 设置密码（可选）
```

#### 3. 添加 SSH 密钥到 ssh-agent

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

#### 4. 复制公钥到剪贴板

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

#### 5. 添加到 GitHub

1. 访问：https://github.com/settings/keys
2. 点击 **New SSH key**
3. **Title**: 描述（如 "MacBook Pro"）
4. **Key**: 粘贴公钥
5. 点击 **Add SSH key**

#### 6. 更新远程仓库 URL

```bash
cd /Users/maoweihao/cursor/Ear
git remote set-url origin git@github.com:USERNAME/REPO.git
```

## 🔧 快速修复步骤（推荐顺序）

1. ✅ **重新登录 GitHub Desktop**（最简单，先试这个）
2. ✅ **检查仓库权限**（确认有写权限）
3. ✅ **使用 Personal Access Token**（如果重新登录不行）
4. ✅ **使用命令行推送**（临时方案）
5. ✅ **配置 SSH**（长期方案）

## 📝 验证修复

修复后，尝试推送：

```bash
cd /Users/maoweihao/cursor/Ear
git push origin main
```

如果成功，应该看到类似输出：
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
Writing objects: 100% (X/X), done.
To https://github.com/USERNAME/REPO.git
   abc1234..def5678  main -> main
```

## 🆘 如果还是不行

1. **检查网络连接**：确保能访问 GitHub
2. **检查防火墙**：确保没有阻止 Git/GitHub Desktop
3. **重启 GitHub Desktop**：完全退出后重新打开
4. **查看详细错误**：GitHub Desktop 的 Help → Show Logs 查看详细错误信息

## 💡 预防措施

1. **定期更新 GitHub Desktop**：保持最新版本
2. **使用 SSH 认证**：更稳定，不需要频繁更新 Token
3. **保存 Personal Access Token**：在安全的地方保存，避免丢失

---

**建议先尝试方案 1（重新登录），这通常能解决大部分问题！**

