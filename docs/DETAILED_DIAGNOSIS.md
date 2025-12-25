# 详细诊断步骤

## 问题1：hot查询返回0

请执行以下命令查看详细日志：

```bash
cd /opt/podroom

# 查看hot查询的详细日志
pm2 logs podroom --out --lines 500 --nostream | grep -A 5 -B 5 "热门播客\|hot\|热度排序" | tail -40

# 查看是否有错误
pm2 logs podroom --err --lines 200 --nostream | grep -iE "hot|热门|likeCount|orderBy" | tail -20

# 测试hot查询并查看实时日志
pm2 logs podroom --out --lines 0 &
LOG_PID=$!
sleep 1
curl -s "http://localhost:3005/api/public/list?type=hot&limit=15" > /dev/null
sleep 2
kill $LOG_PID 2>/dev/null
```

## 问题2：播客详情页超时

请执行以下命令查看详细日志：

```bash
cd /opt/podroom

# 查看播客详情查询的详细日志
pm2 logs podroom --out --lines 500 --nostream | grep -A 5 -B 5 "查询播客\|podcast.*id" | tail -40

# 查看是否有错误
pm2 logs podroom --err --lines 200 --nostream | grep -iE "podcast|查询|timeout" | tail -20

# 测试详情查询并查看实时日志
PODCAST_ID="cmjl2axe90005lyuqvpj52oes"
pm2 logs podroom --out --lines 0 &
LOG_PID=$!
sleep 1
timeout 10 curl -s "http://localhost:3005/api/public/podcast?id=$PODCAST_ID" > /dev/null
sleep 2
kill $LOG_PID 2>/dev/null
```

