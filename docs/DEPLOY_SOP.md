# 上线与回滚 SOP（需主动提醒）

> 目的：避免新功能影响主站可用性，发现异常可快速回滚。

## 0. 原则
- 小步快跑、可灰度、可回滚。
- 新功能与主站隔离（独立进程/端口/子域或 feature flag）。
- 任何构建/发布前先有稳定基线和一键回滚方案。

## 1. 预检清单（上线前必须执行）
1) 代码与配置
- `git status` 干净，锁定稳定基线（tag 或 release 分支）。
- `.env` 校验：必填项、无多余引号；`pm2 env podroom` 能看到变量。
- 端口/Nginx：确认 proxy_pass 目标端口正确且未被占用。
- 依赖：`pnpm install --frozen-lockfile`；`npx prisma generate`。
- 可执行文件：`which ffmpeg && ffprobe` 存在。

2) 连通性与自测
- OSS：运行上传自检脚本（若有）。
- 数据库：简单读写自检。
- 任务队列：确认进程运行、无堆积/卡死。
- HTTPS/证书：有效期检查。

3) 安全
- SSH 加固（禁用密码登录）、关闭无用端口/服务。
- 检查异常进程/定时任务/网络连接（`ps aux`、`netstat`、`crontab -l`）。

## 2. 发布流程（推荐）
1) 在 staging/独立进程验证新功能，若需线上灰度，用 feature flag 控制。
2) 构建（生产模式）：`NODE_OPTIONS='--max-old-space-size=1536' pnpm build`
   - 若资源不足，可临时 dev 模式，但需限制并发并接受首次访问编译开销。
3) 启动：
   - 生产：`pm2 start ecosystem.config.js --env production`
   - 或 dev：`pm2 start pnpm --name podroom -- run dev`
4) 冒烟：
   - 首页、搜索、详情页加载
   - 新播客全链路：下载→分段→OSS→ASR→DB→前端轮询展示
   - 已存在播客快速返回
5) 打 tag，记录基线。保留上一稳定 tag 以便回滚。

## 3. 回滚流程（出现问题立刻执行）
1) `pm2 stop podroom`
2) `git reset --hard <上一个稳定 tag>` + `git clean -fd`
3) `pnpm install --frozen-lockfile`（若需）
4) 生产模式：`pnpm build`（或使用已有 .next 压缩包）
5) 启动：`pm2 start ecosystem.config.js --env production`
6) 冒烟验证同上

## 4. 监控与告警（尽量覆盖）
- 进程与端口：pm2 进程存活、Nginx upstream 连通性。
- 任务/业务：队列堆积、任务失败率、OSS 上传失败、ASR 超时/失败、DB 连接错误。
- 系统：CPU/内存/磁盘、带宽、证书有效期。
- 前端可用性：定时 curl 首页/详情，5xx/超时告警。

## 5. 变更拆分与策略
- 大改拆分为多次上线：UI/路由、任务并发/队列、Nginx/HTTPS、第三方集成分批。
- 默认关闭的新功能（feature flag），小流量灰度后再全量。
- 明确端口与进程隔离，避免互相影响。

## 6. 为什么要这样做（本次事故学习点）
- 新功能直接耦合主站，缺灰度/隔离 → 主站两天不可用。
- 无一键回滚 → 故障恢复慢。
- 安全防护不足 → 服务器被入侵。
- 环境/配置不一致 → 本地可跑、线上失败（.env、ffmpeg、PM2 env、并发/端口差异）。
- 监控缺失 → 问题延迟暴露。

> 提醒：每次上线前，请对照本文件逐项确认；如未满足“可回滚、可灰度、已自测”条件，禁止直接影响主站流量。

