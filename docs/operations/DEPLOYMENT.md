# Deployment Guide

**Server:** 187.127.112.42 (root access via SSH)  
**App path:** `/opt/basetaa-erp-platform`  
**Process:** PM2 process named `basetaa-erp`

---

## Standard Deploy (code changes only)

```bash
ssh root@187.127.112.42

cd /opt/basetaa-erp-platform

# Pull latest from GitHub
git pull origin main

# Build
npm run build

# Graceful reload (zero-downtime — preferred over restart)
pm2 reload ecosystem.config.js
```

Use `pm2 reload` not `pm2 restart`. Reload starts a new process before killing the old one, eliminating the brief 502 window that occurs with hard restart.

---

## Deploy with Schema Changes (Prisma migration)

```bash
ssh root@187.127.112.42
cd /opt/basetaa-erp-platform

git pull origin main

# Apply schema changes to production DB
npx prisma db push

# Regenerate Prisma client
npx prisma generate

npm run build
pm2 reload ecosystem.config.js
```

---

## First-Time Setup (new server)

```bash
# Install Node.js (via nvm or apt)
# Install PM2 globally
npm install -g pm2

# Clone repo
git clone https://github.com/EslamHamed2017/basetaa-erp-platform.git /opt/basetaa-erp-platform
cd /opt/basetaa-erp-platform

# Install dependencies
npm install

# Create .env.local (see ENV_VARS.md — do NOT copy from git)
nano .env.local

# Apply DB schema
npx prisma db push

# Build
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow the output command to enable on boot
```

---

## PM2 Commands Reference

```bash
pm2 list                          # Show all processes
pm2 logs basetaa-erp --lines 50   # Stream last 50 lines of logs
pm2 logs basetaa-erp --nostream --lines 100  # Print last 100 lines and exit
pm2 reload ecosystem.config.js    # Graceful reload (preferred)
pm2 restart basetaa-erp           # Hard restart (brief downtime)
pm2 stop basetaa-erp              # Stop process
pm2 start ecosystem.config.js     # Start from config file
pm2 save                          # Persist current process list
pm2 status                        # Alias for pm2 list
```

---

## Ecosystem Config

File: `/opt/basetaa-erp-platform/ecosystem.config.js`

```js
module.exports = {
  apps: [{
    name: 'basetaa-erp',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/opt/basetaa-erp-platform',
    instances: 1,
    exec_mode: 'fork',
    wait_ready: true,
    listen_timeout: 10000,
    kill_timeout: 5000,
    env: { NODE_ENV: 'production', PORT: 3000 },
  }]
}
```

---

## What the Build Produces

`npm run build` produces a `.next/` directory with:
- Static HTML for pre-rendered pages (`/site`, `/admin/login`)
- Server-rendered routes compiled to Node.js bundles
- Middleware bundle (27.1 kB)

All routes in the build output must be present for the app to serve correctly. Check `npm run build` output for any route compilation errors before reloading PM2.

---

## Verifying Deployment

After deploy, confirm:

```bash
# App responds on localhost
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/site
# Expected: 200

# Tenant gate returns 403 without auth header
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/tenant-gate?sub=testco"
# Expected: 403

# Tenant gate returns 200 with auth header (for existing ready tenant)
curl -s -o /dev/null -w "%{http_code}" -H "x-nginx-internal: 1" "http://localhost:3000/api/tenant-gate?sub=testco"
# Expected: 200

# Odoo health
curl -s -o /dev/null -w "%{http_code}" http://localhost:8069/web/health
# Expected: 200
```
