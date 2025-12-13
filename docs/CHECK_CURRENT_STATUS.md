# 检查当前状态

## 如果 `lsof -i :3005` 显示为空

可能的情况：
1. 进程已经停止
2. 应用运行在其他端口
3. Nginx 在代理，但后端应用已停止

## 需要检查的内容

### 1. 检查所有 Node.js 进程

```bash
ps aux | grep node
```

### 2. 检查所有端口占用

```bash
# 检查常用端口
lsof -i :3000
lsof -i :3005
lsof -i :3001
```

### 3. 检查 Nginx 配置

```bash
cat /etc/nginx/sites-available/podroom | grep proxy_pass
```

查看 Nginx 代理到哪个端口。

### 4. 检查 PM2 状态

```bash
pm2 list
pm2 logs podroom --lines 20
```

### 5. 测试网站访问

```bash
# 测试本地端口
curl -I http://localhost:3005
curl -I http://localhost:3000

# 测试域名
curl -I https://podcasttoinsight.top
```

## 如果网站仍然可以访问

说明应用可能运行在其他端口，或者通过其他方式运行。

