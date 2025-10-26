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
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/podroom/err.log',
    out_file: '/var/log/podroom/out.log',
    log_file: '/var/log/podroom/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
