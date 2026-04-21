# Runbook: PM2 Operations

---

## Normal Deploy (preferred — zero-downtime)

```bash
ssh root@187.127.112.42
cd /opt/basetaa-erp-platform
git pull origin main
npm run build
pm2 reload ecosystem.config.js
```

`pm2 reload` starts a new process, waits for it to be ready, then kills the old one.  
No 502 window. Always prefer this over `pm2 restart`.

---

## Hard Restart (causes brief ~200ms 502)

Only use if the process is stuck and `reload` doesn't work:

```bash
pm2 restart basetaa-erp
```

This kills the process immediately and starts a new one. Any in-flight requests get 502 during the gap.

---

## Check Process Health

```bash
pm2 list
# Look for: status=online, cpu < 100%, memory reasonable

pm2 logs basetaa-erp --lines 50
# Look for: ✓ Ready in Xms — confirms Next.js is listening
# Watch for: TypeError, Error, unhandledRejection — crash indicators
```

---

## Process is Crashing (restart loop)

Signs: restart counter in `pm2 list` is increasing rapidly.

```bash
# Read error log without streaming
pm2 logs basetaa-erp --nostream --lines 100 2>&1 | head -60

# Common causes:
# 1. Missing .env.local variable → "X is not set" errors
# 2. Database unreachable → Prisma connection error
# 3. Port 3000 already in use → EADDRINUSE
```

Check port:
```bash
ss -tlnp | grep 3000
```

If another process holds 3000:
```bash
kill $(lsof -t -i:3000)
pm2 start ecosystem.config.js
```

---

## Process Not Found After Server Reboot

PM2 process list is lost on reboot if `pm2 save` + `pm2 startup` was not run.

```bash
cd /opt/basetaa-erp-platform
pm2 start ecosystem.config.js
pm2 save
```

To ensure PM2 auto-starts on boot:
```bash
pm2 startup  # follow the command it prints
pm2 save
```

---

## Viewing Logs

```bash
pm2 logs basetaa-erp                   # Live stream (Ctrl+C to exit)
pm2 logs basetaa-erp --lines 100       # Last 100 lines + live stream
pm2 logs basetaa-erp --nostream --lines 50  # Last 50 lines, exit

# Log files on disk:
# /root/.pm2/logs/basetaa-erp-out.log   — stdout (Next.js ready messages)
# /root/.pm2/logs/basetaa-erp-error.log — stderr (crashes, errors)
```
