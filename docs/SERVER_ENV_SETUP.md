# 服务器环境变量配置指南

## 在服务器上编辑.env文件

### 方法1：使用nano编辑器（推荐，简单易用）

```bash
# 1. 进入项目目录
cd /opt/podroom

# 2. 编辑.env文件
nano .env
```

**在nano编辑器中的操作**：
- 使用方向键移动光标
- 在文件末尾添加以下内容：
```bash
# MuleRun配置
MULERUN_AGENT_KEY=mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100
```

- 保存：按 `Ctrl + O`，然后按 `Enter` 确认
- 退出：按 `Ctrl + X`

### 方法2：使用vi/vim编辑器

```bash
# 1. 进入项目目录
cd /opt/podroom

# 2. 编辑.env文件
vi .env
# 或
vim .env
```

**在vi/vim编辑器中的操作**：
1. 按 `i` 进入插入模式
2. 使用方向键移动到文件末尾
3. 按 `Enter` 换行，添加以下内容：
```bash
# MuleRun配置
MULERUN_AGENT_KEY=mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100
```

4. 保存并退出：
   - 按 `Esc` 退出插入模式
   - 输入 `:wq` 然后按 `Enter`（保存并退出）
   - 或输入 `:q!` 然后按 `Enter`（不保存退出）

### 方法3：使用echo追加（最简单，但需要小心）

```bash
cd /opt/podroom

# 追加MuleRun配置到.env文件末尾
cat >> .env << 'EOF'

# MuleRun配置
MULERUN_AGENT_KEY=mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100
EOF
```

### 方法4：使用sed添加（如果文件不存在则创建）

```bash
cd /opt/podroom

# 检查.env文件是否存在
if [ ! -f .env ]; then
    touch .env
fi

# 添加配置（如果不存在）
grep -q "MULERUN_AGENT_KEY" .env || cat >> .env << 'EOF'

# MuleRun配置
MULERUN_AGENT_KEY=mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100
EOF
```

## 验证配置是否正确

```bash
# 检查环境变量是否已添加
grep MULERUN .env

# 应该看到：
# MULERUN_AGENT_KEY=...
# MULERUN_API_BASE_URL=...
# MULERUN_QUERY_COST_CREDITS=100
```

## 重启应用使配置生效

```bash
# 如果使用PM2
pm2 restart podroom

# 或使用其他进程管理器
# systemctl restart podroom
# 或直接重启Node.js进程
```

## 完整操作步骤（推荐使用nano）

```bash
# 1. 进入项目目录
cd /opt/podroom

# 2. 编辑.env文件
nano .env

# 3. 在文件末尾添加以下内容（复制粘贴）：
# MuleRun配置
MULERUN_AGENT_KEY=mck-sK5aqxhTzAM3n8gn77e3eoFhBoeRebdcq3-dnHzUVIO
MULERUN_API_BASE_URL=https://api.mulerun.com
MULERUN_QUERY_COST_CREDITS=100

# 4. 保存：Ctrl+O, Enter
# 5. 退出：Ctrl+X

# 6. 验证
grep MULERUN .env

# 7. 重启应用
pm2 restart podroom
```

## 注意事项

1. **不要删除现有的环境变量**：只添加新的MuleRun配置
2. **确保格式正确**：每行一个变量，格式为 `KEY=value`
3. **不要有空格**：等号前后不要有空格（`KEY=value` 正确，`KEY = value` 错误）
4. **Agent Key保密**：不要泄露给他人

