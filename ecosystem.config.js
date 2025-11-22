// 加载 .env 文件
const fs = require('fs');
const path = require('path');

// 读取 .env 文件
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          // 移除引号
          let value = valueParts.join('=').trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key.trim()] = value;
        }
      }
    });
  }
  
  return env;
}

const envVars = loadEnvFile();

module.exports = {
  apps: [{
    name: 'podroom',
    script: 'npm',
    args: 'start',
    cwd: '/opt/podroom',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
      PORT: 3010,
      // 从 .env 文件加载所有环境变量
      ...envVars
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3010,
      // 从 .env 文件加载所有环境变量
      ...envVars
    },
    error_file: '/var/log/podroom/err.log',
    out_file: '/var/log/podroom/out.log',
    log_file: '/var/log/podroom/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
