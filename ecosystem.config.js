module.exports = {
  apps: [
    {
      name: 'crmge-api',
      cwd: '/apps/crmge/server',
      script: 'dist/index.js',
      env: {
        PORT: '3005',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/crmge/error.log',
      out_file: '/var/log/crmge/output.log',
    },
  ],
};
