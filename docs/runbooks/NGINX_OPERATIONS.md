# Runbook: Nginx Operations

---

## Test Config Before Reloading

Always test before applying:
```bash
nginx -t
# Expected: syntax is ok / test is successful
```

---

## Reload Nginx (no downtime)

```bash
nginx -s reload
```

This gracefully reloads config. In-flight requests complete with old config. New requests use new config.

---

## Full Config Dump

```bash
nginx -T
# Prints all included config files concatenated
```

---

## Config File Location

```
/etc/nginx/sites-enabled/basetaa-erp
```

Editable directly. After editing:
```bash
nginx -t && nginx -s reload
```

Reference copy (for documentation): `docs/project-state/nginx-workspace.conf`

---

## Diagnose a 502 Bad Gateway

502 = Nginx can't connect to the upstream (Next.js on :3000 or Odoo on :8069).

```bash
# 1. Is the upstream running?
ss -tlnp | grep 3000   # Next.js
ss -tlnp | grep 8069   # Odoo

# 2. Check app log
pm2 logs basetaa-erp --nostream --lines 30

# 3. Check Nginx error log
tail -30 /var/log/nginx/basetaa-erp.error.log

# 4. Test directly
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/site
curl -s -o /dev/null -w "%{http_code}" http://localhost:8069/web/health
```

Most common cause: PM2 was restarting. If the app is back up, the 502 resolves on its own.

---

## Diagnose a 403 on Tenant Subdomain

403 from `acme.erp.basetaa.com` can mean:
1. Tenant not in DB → not-found
2. Tenant exists but `status=inactive` or `provisioningState≠ready`
3. Tenant gate itself returned an error

```bash
# Check tenant status in DB
docker exec basetaa-odoo-deploy-db-1 psql -U odoo -d basetaa_control -c \
  "SELECT status, \"provisioningState\", \"odooDb\" FROM tenants WHERE \"normalizedSubdomain\" = 'acme';"

# Test gate manually
curl -s -w "\nHTTP %{http_code}\n" \
  -H "x-nginx-internal: 1" \
  "http://localhost:3000/api/tenant-gate?sub=acme"
```

---

## Renew SSL Certificate

Certbot auto-renews via systemd timer. To manually renew:

```bash
# Dry run first
certbot renew --dry-run

# Actual renewal
certbot renew
nginx -s reload   # picks up new cert
```

Check timer status:
```bash
systemctl status certbot.timer
systemctl list-timers | grep certbot
```

---

## Common Nginx Log Locations

```
/var/log/nginx/error.log              Global Nginx error log (startup, config issues)
/var/log/nginx/access.log             Global access log (HTTP 80 traffic, before SSL redirect)
/var/log/nginx/basetaa-erp.access.log Platform domains access log (erp + control)
/var/log/nginx/basetaa-erp.error.log  Platform domains error log
/var/log/nginx/basetaa-tenant.access.log  Tenant subdomain access log
/var/log/nginx/basetaa-tenant.error.log   Tenant subdomain error log
```
