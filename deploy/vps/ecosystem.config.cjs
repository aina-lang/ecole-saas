// Configuration pm2 de l'API École SaaS (VPS).
const path = require('path')
module.exports = {
  apps: [
    {
      name: 'ecole-api',
      cwd: path.join(__dirname, '..', '..', 'server'),
      script: 'dist/src/main.js', // nest build garde src/ (prisma.config.ts est hors de src)
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      // Les variables sensibles viennent de server/.env (lien vers ~/ecole-saas.env).
      time: true,
    },
  ],
}
