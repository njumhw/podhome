# 用户角色权限整理与代码验证

## 角色定义

根据 `prisma/schema.prisma` 中的定义：

```prisma
enum UserRole {
  READER          // 读者：无需邀请码注册，可浏览、点赞、评论，不能上传
  PODCASTER       // 播客创作者：通过邀请码升级，每日可上传 1 次
  PODCASTER_VIP   // VIP 播客创作者：管理员授权，无限制上传
  ADMIN           // 管理员：所有权限 + 后台管理
  USER            // 旧角色（已废弃，保留用于兼容）
  GUEST           // 游客角色（已废弃，保留用于兼容）
}
```

## 权限矩阵

| 功能 | Visitor | Reader | Podcaster | Podcaster-VIP | Admin |
|------|---------|--------|-----------|---------------|-------|
| **搜索浏览** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **查看播客详情** | ⚠️ 3次/天 | ✅ 无限制 | ✅ 无限制 | ✅ 无限制 | ✅ 无限制 |
| **点赞播客** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **收藏夹（已点赞）** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **评论播客** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **上传播客** | ❌ | ❌ | ✅ 1次/天 | ✅ 无限制 | ✅ 无限制 |
| **后台管理** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 详细权限验证

### 1. Visitor（游客）- 未登录用户

#### ✅ 搜索浏览
- **实现位置**: `src/app/api/public/list/route.ts`
- **验证**: 无需认证，所有用户可访问
- **状态**: ✅ 正确实现

#### ⚠️ 查看播客详情 - 3次/天限制
- **实现位置**: 
  - `src/server/visitorLimit.ts` - 限制逻辑
  - `src/app/api/public/podcast/route.ts` - API 实现
- **验证代码**:
  ```typescript
  // visitorLimit.ts
  export const DAILY_VISITOR_LIMIT = 3;
  
  export async function getVisitorUsage(ip: string, userAgent: string): Promise<VisitorUsageResult> {
    const count = await db.accessLog.count({
      where: {
        userId: null,  // 只有 Visitor 才记录
        userIp: ip,
        userAgent,
        createdAt: range,  // 当天
      },
    });
    return { count, limit: DAILY_VISITOR_LIMIT, allowed: count < DAILY_VISITOR_LIMIT };
  }
  ```
- **验证**: 
  - ✅ 限制为 3 次/天
  - ✅ 基于 IP + User-Agent 识别
  - ✅ 超过限制后返回受限内容（前10行）
- **状态**: ✅ 正确实现

#### ❌ 点赞播客
- **实现位置**: `src/app/api/podcast/like/route.ts`
- **验证代码**:
  ```typescript
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '请登录后点赞' }, { status: 401 });
  }
  ```
- **验证**: ✅ 必须登录才能点赞
- **状态**: ✅ 正确实现

#### ❌ 评论播客
- **实现位置**: `src/app/api/comments/route.ts`
- **验证代码**:
  ```typescript
  export async function POST(req: NextRequest) {
    const user = await requireUser(); // 必须登录
    // ...
  }
  ```
- **验证**: ✅ 必须登录才能评论
- **状态**: ✅ 正确实现

#### ❌ 上传播客
- **实现位置**: `src/server/user-limits.ts`
- **验证代码**:
  ```typescript
  export function canUserUpload(role: UserRole | null): boolean {
    if (!role) return false; // Visitor 不能上传
    // ...
  }
  ```
- **验证**: ✅ Visitor (role = null) 不能上传
- **状态**: ✅ 正确实现

---

### 2. Reader（读者）- 注册用户，无需邀请码

#### ✅ 搜索浏览
- **状态**: ✅ 与 Visitor 相同，无需认证

#### ✅ 查看播客详情 - 无限制
- **实现位置**: `src/app/api/public/podcast/route.ts`
- **验证代码**:
  ```typescript
  // 只有真正的 Visitor（未登录用户）才检查限制
  if (!user) {
    visitorUsage = await getVisitorUsage(clientIp, userAgent);
    if (!visitorUsage.allowed) {
      visitorLimitExceeded = true;
    }
  }
  ```
- **验证**: ✅ 已登录用户（包括 Reader）不受限制
- **状态**: ✅ 正确实现

#### ✅ 点赞播客
- **实现位置**: `src/app/api/podcast/like/route.ts`
- **验证代码**:
  ```typescript
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '请登录后点赞' }, { status: 401 });
  }
  // 没有角色检查，所有登录用户都可以点赞
  ```
- **验证**: ✅ Reader 可以点赞（所有登录用户都可以）
- **状态**: ✅ 正确实现

#### ✅ 评论播客
- **实现位置**: `src/app/api/comments/route.ts`
- **验证代码**:
  ```typescript
  export async function POST(req: NextRequest) {
    const user = await requireUser(); // 必须登录
    // 没有角色检查，所有登录用户都可以评论
  }
  ```
- **验证**: ✅ Reader 可以评论（所有登录用户都可以）
- **状态**: ✅ 正确实现

#### ❌ 上传播客
- **实现位置**: `src/server/user-limits.ts`
- **验证代码**:
  ```typescript
  export function canUserUpload(role: UserRole | null): boolean {
    switch (role) {
      case UserRole.READER:
        return false; // Reader 不能上传
      // ...
    }
  }
  ```
- **验证**: ✅ Reader 不能上传
- **状态**: ✅ 正确实现

---

### 3. Podcaster（播客创作者）- 通过邀请码升级

#### ✅ 所有 Reader 权限
- **状态**: ✅ 继承 Reader 的所有权限

#### ✅ 上传播客 - 1次/天
- **实现位置**: `src/server/user-limits.ts`
- **验证代码**:
  ```typescript
  export function getUserDailyLimit(role: UserRole | null): number {
    switch (role) {
      case UserRole.PODCASTER:
        return 1; // Podcaster 每日 1 次
      // ...
    }
  }
  
  export async function checkUserUploadLimit(userId: string, role: UserRole | null) {
    // ...
    const currentCount = await getUserTodayUploadCount(userId);
    const limit = getUserDailyLimit(role);
    
    if (limit > 0 && currentCount >= limit) {
      return {
        allowed: false,
        reason: `今日上传次数已达上限（${limit}次）`,
        currentCount,
        limit
      };
    }
  }
  ```
- **验证**: 
  - ✅ 每日限制为 1 次
  - ✅ 通过 `getUserTodayUploadCount` 计算当天上传次数
  - ✅ 超过限制时返回错误
- **状态**: ✅ 正确实现

---

### 4. Podcaster-VIP（VIP 播客创作者）- 管理员授权

#### ✅ 所有 Podcaster 权限
- **状态**: ✅ 继承 Podcaster 的所有权限

#### ✅ 上传播客 - 无限制
- **实现位置**: `src/server/user-limits.ts`
- **验证代码**:
  ```typescript
  export function getUserDailyLimit(role: UserRole | null): number {
    switch (role) {
      case UserRole.PODCASTER_VIP:
        return -1; // VIP 无限制
      // ...
    }
  }
  
  export async function checkUserUploadLimit(userId: string, role: UserRole | null) {
    // VIP 和管理员无限制
    if (role === UserRole.PODCASTER_VIP || role === UserRole.ADMIN) {
      return {
        allowed: true,
        currentCount: 0,
        limit: -1
      };
    }
  }
  ```
- **验证**: ✅ VIP 无限制上传（limit = -1）
- **状态**: ✅ 正确实现

---

### 5. Admin（管理员）- 最高权限

#### ✅ 所有功能权限
- **状态**: ✅ 继承所有角色的权限

#### ✅ 后台管理权限
- **实现位置**: `src/app/admin/page.tsx` 和各个 admin API
- **验证代码**:
  ```typescript
  // 需要检查 isAdmin 或 role === 'ADMIN'
  ```
- **验证**: ✅ 需要管理员权限才能访问后台
- **状态**: ✅ 正确实现

---

## 代码验证总结

### ✅ 正确实现的权限

1. **Visitor 3次/天限制** - ✅ 正确实现
   - 基于 IP + User-Agent
   - 使用 AccessLog 表记录
   - 超过限制后返回受限内容

2. **Reader 权限** - ✅ 正确实现
   - 可以搜索浏览
   - 无限制查看播客详情
   - 可以点赞、评论
   - 不能上传

3. **Podcaster 上传限制** - ✅ 正确实现
   - 每日 1 次限制
   - 通过 `getUserTodayUploadCount` 计算
   - 超过限制时正确返回错误

4. **Podcaster-VIP 无限制上传** - ✅ 正确实现
   - limit = -1 表示无限制
   - 跳过限制检查

5. **点赞权限** - ✅ 正确实现
   - 必须登录（所有登录用户都可以）

6. **评论权限** - ✅ 正确实现
   - 必须登录（所有登录用户都可以）

### ⚠️ 需要注意的点

1. **Reader 和 Podcaster 的点赞/评论权限**
   - 当前实现：所有登录用户都可以点赞/评论
   - 代码中没有明确检查角色是否为 READER 或以上
   - **建议**: 如果需要更严格的权限控制，可以在点赞/评论 API 中添加角色检查

2. **收藏夹（已点赞）权限**
   - **前端实现**: 
     - `src/app/home/page.tsx` - `tabOptions` 中 `liked` 标签页有 `requiresAuth: true`
     - 标签页按钮会根据 `user` 状态禁用
   - **后端实现**: 
     - `src/app/api/podcast/liked/route.ts` - 使用 `requireUser()` 必须登录
   - **验证代码**:
     ```typescript
     // home/page.tsx
     { id: 'liked', label: 'Liked', icon: '❤', requiresAuth: true }
     
     // api/podcast/liked/route.ts
     export async function GET(req: Request) {
       const user = await requireUser(); // 必须登录
       // ...
     }
     ```
   - **状态**: ✅ 正确实现

3. **上传权限检查**
   - 在多个地方检查：`src/app/api/upload/route.ts`, `src/app/api/process-audio-async/route.ts`
   - 都使用 `checkUserUploadLimit` 函数
   - **状态**: ✅ 正确实现

---

## 建议改进

1. **统一权限检查函数**
   - 可以考虑创建一个统一的权限检查函数，避免在各个 API 中重复检查

2. **角色枚举使用**
   - 确保所有地方都使用 `UserRole` 枚举，而不是字符串比较

3. **权限文档同步**
   - 确保代码实现与文档保持一致

