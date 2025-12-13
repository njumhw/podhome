# 诊断 PM2 重启循环问题

## 问题现象

- `lsof -i :3005 | grep LISTEN` 没有输出（没有进程在监听）
- 但 PM2 启动时报端口冲突
- 线上页面可以正常使用

## 可能的原因

1. **PM2 进程在频繁重启**：启动时短暂占用端口，然后崩溃，PM2 立即重启，形成循环
2. **应用运行在其他端口**：实际应用可能在 3000 或其他端口，Nginx 代理到那里
3. **端口被短暂占用**：启动瞬间占用，但立即失败

## 诊断步骤

### 1. 检查 PM2 进程状态

```bash
pm2 list
```

查看 `podroom` 进程的 `uptime` 和 `restart` 次数。如果 `uptime` 很短且 `restart` 次数很高，说明在频繁重启。

### 2. 检查 PM2 日志

```bash
pm2 logs podroom --lines 50
```

查看是否有端口冲突错误，以及错误发生的频率。

### 3. 检查所有 Node.js 进程

```bash
ps aux | grep node
```

查看是否有多个 Node.js 进程在运行。

### 4. 检查 Nginx 实际代理的端口

```bash
# 查看 Nginx 配置
cat /etc/nginx/sites-available/podroom | grep proxy_pass

# 测试实际后端端口
curl -I http://localhost:3005
curl -I http://localhost:3000
```

### 5. 检查应用是否真的在运行

```bash
# 检查所有端口占用
netstat -tlnp | grep -E ":(3000|3005)"
```

## 解决方案

如果确认是 PM2 重启循环：

1. **停止 PM2 进程**
2. **等待几秒让端口完全释放**
3. **检查是否有残留进程**
4. **重新启动**

