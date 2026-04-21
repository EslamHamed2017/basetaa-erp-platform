# Troubleshooting Guide

---

## 502 Bad Gateway on erp.basetaa.com or control.erp.basetaa.com

**Cause:** Nginx can't reach Next.js on port 3000.

**Check:**
```bash
pm2 list                      # is basetaa-erp online?
ss -tlnp | grep 3000          # is something listening on 3000?
pm2 logs basetaa-erp --nostream --lines 30  # any crash errors?
```

**Fix:**
```bash
pm2 reload ecosystem.config.js   # or pm2 restart basetaa-erp if stuck
```

**Note:** Brief 502s during PM2 restart are expected (~200ms). Use `pm2 reload` to prevent them.

---

## 502 on tenant subdomain (acme.erp.basetaa.com)

Two upstreams are involved: Next.js (gate) and Odoo.

**Check gate first:**
```bash
curl -s -w "\n%{http_code}" -H "x-nginx-internal: 1" \
  "http://localhost:3000/api/tenant-gate?sub=acme"
# 200 = gate passes, 502 is in Odoo proxy
# 403 = gate fails, check tenant record
```

**If gate passes but still 502:**
```bash
curl http://localhost:8069/web/health   # is Odoo up?
docker compose -f /opt/basetaa-odoo-deploy/docker-compose.yml ps
```

---

## 403 on tenant subdomain

**Cause:** Tenant gate returned 403. Tenant is inactive, not ready, or not found.

**Check:**
```bash
docker exec basetaa-odoo-deploy-db-1 psql -U odoo -d basetaa_control -c \
  "SELECT status, \"provisioningState\" FROM tenants WHERE \"normalizedSubdomain\" = 'acme';"
```

**Fix:** Depends on state:
- `provisioningState=failed` → Retry Provisioning in admin panel
- `status=inactive` → Activate in admin panel if intentional
- Not in DB → signup never completed, or different subdomain

---

## Odoo login fails (correct credentials)

**Most likely cause:** Credential handoff didn't run or failed during provisioning.

**Check app log:**
```bash
pm2 logs basetaa-erp --nostream --lines 100 | grep -i "credential\|xmlrpc\|handoff"
```

**Check tenant in admin panel:**
- If `provisioningState=failed` → Retry Provisioning (runs handoff again)
- If `provisioningState=ready` → Credential handoff ran but may have failed silently

**Manual credential reset:**
See [Provisioning Failure Runbook](../runbooks/PROVISIONING_FAILURE.md) — section D.

---

## "Failed to find Server Action" in PM2 logs

**Cause:** Browser has a stale build ID from a previous deployment. Not a server crash.

**Impact:** None on the server. Affects only the browser that has the old page cached.

**Fix:** User should hard refresh (`Ctrl+Shift+R`). Self-resolves after browser cache clears.

---

## Provisioning takes > 30 seconds or times out

**Cause:** Odoo is slow starting a new DB (rare on warm server, common after cold restart).

**Check:**
```bash
docker compose -f /opt/basetaa-odoo-deploy/docker-compose.yml logs odoo | tail -20
```

**Immediate:** The signup request will eventually fail with `provisioningState=failed`. Use Retry Provisioning in admin panel once Odoo is healthy.

**Prevention:** Keep Odoo container always running. Don't restart it during signup load.

---

## App crashes on startup (PM2 restart loop)

**Symptom:** PM2 restart counter incrementing rapidly. `pm2 logs` shows repeated crashes.

**Most common causes:**

1. **Missing env var:**
   ```
   Error: ODOO_URL environment variable is not set.
   Error: DATABASE_URL is not set.
   ```
   Fix: Check `.env.local` on server — add missing variable.

2. **DB unreachable:**
   ```
   PrismaClientInitializationError: Can't reach database server
   ```
   Fix: Check Docker Postgres is running.
   ```bash
   docker compose -f /opt/basetaa-odoo-deploy/docker-compose.yml ps
   ```

3. **Port already in use:**
   ```
   Error: listen EADDRINUSE: address already in use :::3000
   ```
   Fix:
   ```bash
   kill $(lsof -t -i:3000)
   pm2 start ecosystem.config.js
   ```

---

## Admin panel login not working

**Cause:** Wrong `ADMIN_EMAIL` or `ADMIN_PASSWORD` in `.env.local`.

**Check:**
```bash
grep ADMIN /opt/basetaa-erp-platform/.env.local
```

After updating `.env.local`: `pm2 reload ecosystem.config.js` to pick up new values.

---

## Nginx config changes not taking effect

```bash
nginx -t          # confirm syntax OK
nginx -s reload   # apply
```

If `nginx -t` fails — fix the syntax error before reloading (existing config keeps serving).

---

## Odoo not serving correct database

**Symptom:** `acme.erp.basetaa.com` shows a different company's Odoo, or shows the database selector.

**Cause:** `dbfilter` is wrong or not set in `odoo.conf`.

**Check:**
```bash
cat /opt/basetaa-odoo-deploy/config/odoo.conf | grep dbfilter
# Expected: dbfilter = ^tenant_%d$
```

If missing or wrong:
```bash
nano /opt/basetaa-odoo-deploy/config/odoo.conf
# Set: dbfilter = ^tenant_%d$

docker compose -f /opt/basetaa-odoo-deploy/docker-compose.yml restart odoo
```

---

## SSL certificate errors

```bash
certbot certificates              # check expiry
certbot renew --dry-run           # test renewal
certbot renew && nginx -s reload  # renew and apply
```

Check certbot timer is active:
```bash
systemctl status certbot.timer
```

---

## Checking all system components at once

Quick health sweep:

```bash
# PM2
pm2 list | grep basetaa-erp

# Next.js responding
curl -s -o /dev/null -w "Next.js: %{http_code}\n" http://localhost:3000/site

# Odoo
curl -s -o /dev/null -w "Odoo: %{http_code}\n" http://localhost:8069/web/health

# Nginx
nginx -t 2>&1 | tail -2

# Postgres
docker exec basetaa-odoo-deploy-db-1 psql -U odoo -c "SELECT 1;" -t 2>/dev/null && echo "Postgres: OK"

# SSL cert expiry
certbot certificates 2>/dev/null | grep "Expiry Date"
```
