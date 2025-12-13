# MuleRun UI 修复说明

## 问题描述

1. **签名验证失败**：显示 "Invalid signature" 错误
2. **UI 问题**：MuleRun 页面显示了产品 A 的 Header（包含 "VISITOR", "About", "Login", "Register" 等），用户可能通过这些链接跳转到产品 A，失去付费优势

## 修复内容

### 1. 创建 MuleRun 专用 Layout

**文件**: `src/app/mulerun/layout.tsx`

- 移除了全局的 `Header` 和 `Footer` 组件
- 保持界面简洁，只显示核心内容
- 强制使用 `data-theme="light"`（白色模式）

### 2. 创建 MuleRun 专用详情页

**文件**: `src/app/mulerun/result/[id]/page.tsx`

- 只显示播客的核心信息（标题、作者、摘要、大纲）
- 不包含任何导航链接、Header、Footer
- 使用 Markdown 渲染，保持格式

### 3. 更新 Session 页面

**文件**: `src/app/mulerun/session/page.tsx`

- 示例播客卡片点击后跳转到 `/mulerun/result/[id]`
- 查询结果中的播客点击后跳转到 `/mulerun/result/[id]`
- 移除了内联的播客详情显示，改为跳转链接

### 4. 增强签名验证日志

**文件**: `src/server/mulerun/signature.ts` 和 `src/app/api/mulerun/session/route.ts`

- 增加了详细的日志输出，便于诊断签名验证问题
- 记录参数、签名计算过程等信息

## 部署步骤

### 代码层面

1. **拉取最新代码**：
   ```bash
   git pull origin main
   ```

2. **安装依赖**（如果需要）：
   ```bash
   pnpm install --frozen-lockfile
   ```

3. **生成 Prisma**：
   ```bash
   npx prisma generate
   ```

4. **构建应用**：
   ```bash
   NODE_OPTIONS='--max-old-space-size=1536' pnpm build
   ```

5. **重启应用**：
   ```bash
   pm2 restart podroom
   ```

### 服务器检查

1. **检查环境变量**：
   ```bash
   pm2 env podroom | grep MULERUN_AGENT_KEY
   ```
   确保 `MULERUN_AGENT_KEY` 已正确配置

2. **查看日志**：
   ```bash
   pm2 logs podroom --lines 50
   ```
   查看签名验证的详细日志

### MuleRun 配置

无需修改 MuleRun Creator Studio 的配置，所有修改都在代码层面。

## 签名验证问题排查

如果仍然出现 "Invalid signature" 错误，请检查：

1. **Agent Key 是否正确**：
   - 检查 `.env` 文件中的 `MULERUN_AGENT_KEY`
   - 确保没有多余的空格或引号
   - 重启应用后检查 `pm2 env podroom`

2. **查看详细日志**：
   ```bash
   pm2 logs podroom --lines 100 | grep -i "mulerun\|signature"
   ```
   查看签名验证的详细过程

3. **时间戳问题**：
   - 确保服务器时间同步
   - 签名验证允许 5 分钟的时间差

## 验证步骤

1. **访问 MuleRun Session 页面**：
   - 应该看不到 Header 和 Footer
   - 只显示搜索框和示例播客

2. **点击示例播客**：
   - 应该跳转到 `/mulerun/result/[id]`
   - 详情页不包含 Header、Footer 和导航链接

3. **处理新播客**：
   - 提交播客 URL 后，应该正常处理
   - 完成后点击"查看完整详情"，应该跳转到专用详情页

4. **检查签名验证**：
   - 查看服务器日志，确认签名验证成功
   - 如果失败，查看详细日志找出原因

## 注意事项

- MuleRun 页面现在完全独立，用户无法通过 UI 跳转到产品 A
- 所有 MuleRun 相关的页面都在 `/mulerun/*` 路径下，使用独立的 layout
- 产品 A 的页面不受影响，仍然使用全局 layout（包含 Header 和 Footer）

