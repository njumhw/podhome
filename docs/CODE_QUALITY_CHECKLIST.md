# 代码质量检查清单

## 提交前必检项

### 1. TypeScript 类型检查
```bash
# 运行完整的类型检查
npx tsc --noEmit --skipLibCheck

# 确保没有类型错误（exit code 0）
```

### 2. 变量作用域检查
- ✅ 所有变量在使用前必须已声明
- ✅ 检查 `let`/`const` 变量的声明顺序
- ✅ 确保异步变量在 await 完成后才使用

**常见错误模式：**
```typescript
// ❌ 错误：变量在使用前未声明
await someFunction({
  value: myVar || undefined  // myVar 还未声明
});

let myVar: string | null = null;

// ✅ 正确：先声明，后使用
let myVar: string | null = null;

await someFunction({
  value: myVar || undefined
});
```

### 3. 接口和类型定义
- ✅ 新增字段时，同步更新所有相关接口
- ✅ 检查 `AudioCacheData`、`Podcast` 等共享类型
- ✅ 确保数据库 schema 和 TypeScript 类型一致

### 4. 导入和导出
- ✅ 确保所有使用的类型都已正确导入
- ✅ 检查 `ChatMessage`、`AudioCacheData` 等类型导入

### 5. 构建测试
```bash
# 本地构建测试（模拟生产环境）
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 确保构建成功，没有错误
```

## 常见问题预防

### 问题 1: 变量声明顺序
**症状：** `Block-scoped variable 'xxx' used before its declaration`
**预防：** 
- 在函数顶部声明所有变量
- 按使用顺序组织代码逻辑

### 问题 2: 类型不匹配
**症状：** `Object literal may only specify known properties, and 'xxx' does not exist in type 'YYY'`
**预防：**
- 修改接口时，同步更新所有使用该接口的地方
- 运行 `npx tsc --noEmit` 检查

### 问题 3: HeadersInit 类型问题
**症状：** `Element implicitly has an 'any' type because expression of type 'xxx' can't be used to index type 'HeadersInit'`
**预防：**
- 使用 `Record<string, string>` 类型
- 或使用类型断言 `as Record<string, string>`

## 提交前完整检查流程

```bash
# 1. 类型检查
npx tsc --noEmit --skipLibCheck

# 2. Lint 检查（如果有配置）
pnpm lint

# 3. 构建测试
NODE_OPTIONS='--max-old-space-size=1536' pnpm build

# 4. 检查 git 状态
git status
git diff

# 5. 提交
git add -A
git commit -m "描述性提交信息"
git push origin main
```

## 服务器部署前检查

1. ✅ 本地构建成功
2. ✅ 所有类型错误已修复
3. ✅ 代码已推送到 GitHub
4. ✅ 服务器上可以成功拉取代码
5. ✅ 服务器上构建成功

## 紧急修复流程

如果服务器构建失败：

1. **不要慌张**，先检查错误信息
2. **本地复现**：在本地运行相同的构建命令
3. **修复问题**：根据错误信息修复代码
4. **本地验证**：确保本地构建成功
5. **推送代码**：推送到 GitHub
6. **服务器更新**：在服务器上拉取并重新构建

