module.exports = {
  apps: [
    {
      name: 'plant-swipe',
      script: 'server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M'
    }
  ]
}

