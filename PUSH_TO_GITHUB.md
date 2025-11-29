# 推送到 GitHub 操作指南

## 当前 Git 配置
- **远程仓库**: `https://github.com/njumhw/podhome.git`
- **当前分支**: `main`

## 推送步骤

请在终端中执行以下命令：

```bash
cd /Users/maoweihao/cursor/Ear/podroom

# 1. 检查当前状态
git status

# 2. 添加所有更改
git add -A

# 3. 提交更改（如果还有未提交的）
git commit -m "代码逻辑检查完成，确保编译无问题

- Header中补充USER和GUEST角色的映射处理
- UserStatusBadge添加角色配置不存在时的容错处理
- AboutModal优化initialTab更新逻辑
- 添加代码逻辑检查总结文档"

# 4. 推送到 GitHub
git push origin main
```

## 如果遇到认证问题

如果推送时要求输入用户名和密码，可以使用以下方式之一：

### 方式1: 使用 Personal Access Token
1. 在 GitHub 上生成 Personal Access Token (Settings > Developer settings > Personal access tokens)
2. 推送时使用 token 作为密码

### 方式2: 使用 SSH
```bash
# 检查是否已配置 SSH
ssh -T git@github.com

# 如果未配置，可以更改远程 URL 为 SSH
git remote set-url origin git@github.com:njumhw/podhome.git
git push origin main
```

## 验证推送成功

推送成功后，可以在 GitHub 上查看：
- https://github.com/njumhw/podhome

