# Server Configuration Reference

**Server:** 187.127.112.42  
**OS:** Ubuntu 24.04.4 LTS

---

## Directory Layout

```
/opt/basetaa-erp-platform/     Next.js app (git repo)
  ├── .env.local                Server secrets (NOT in git)
  ├── ecosystem.config.js       PM2 process config
  ├── .next/                    Build output
  ├── src/
  ├── prisma/
  └── ...

/opt/basetaa-odoo-deploy/      Docker Compose for Odoo + Postgres
  ├── docker-compose.yml
  ├── config/
  │   └── odoo.conf             Odoo configuration file
  └── addons/                   Custom Odoo addons (empty currently)

/etc/nginx/sites-enabled/
  └── basetaa-erp               Full Nginx config for all domains

/etc/letsencrypt/live/erp.basetaa.com/
  ├── fullchain.pem
  └── privkey.pem
```

---

## Nginx Configuration

**Config file:** `/etc/nginx/sites-enabled/basetaa-erp`  
**Reference copy:** `docs/project-state/nginx-workspace.conf` (in repo)

### Upstream definitions
```nginx
upstream nextjs {
    server 127.0.0.1:3000;
    keepalive 64;
}

upstream odoo {
    server 127.0.0.1:8069;
    keepalive 32;
}
```

### Key Nginx directives in tenant block
```nginx
# auth_request gate
auth_request /_tenant_gate;
error_page 403 = @nextjs_workspace;

# Internal subrequest
proxy_set_header X-Nginx-Internal 1;
proxy_pass http://nextjs/api/tenant-gate?sub=$sub;

# Odoo DB manager blocked externally
location ~ ^/web/database/ {
    deny all;
}

# Read timeout for Odoo (provisioning can be slow)
proxy_read_timeout 120s;
```

### Testing Nginx config
```bash
nginx -t                   # syntax check
nginx -T                   # full config dump (includes all includes)
nginx -s reload            # graceful reload (no downtime)
```

---

## Odoo Configuration

**Config file:** `/opt/basetaa-odoo-deploy/config/odoo.conf`

```ini
dbfilter = ^tenant_%d$
admin_passwd = [stored in server only — see SECRETS_INDEX.md]
list_db = True
workers = 0
log_level = info
proxy_mode = True
```

**Critical settings explained:**

| Setting | Value | Why |
|---|---|---|
| `dbfilter` | `^tenant_%d$` | `%d` = first subdomain part of hostname. `acme.erp.basetaa.com` → `%d=acme` → matches `tenant_acme` |
| `list_db` | `True` | Required for `/web/database/create` API to work. Must be `True`. |
| `proxy_mode` | `True` | Trusts `X-Forwarded-For` headers from Nginx |
| `workers` | `0` | Single-process mode. Increase for production load. |
| `admin_passwd` | [secret] | Used for all DB create/drop/list API calls |

**Restart Odoo after config changes:**
```bash
cd /opt/basetaa-odoo-deploy
docker compose restart odoo
# or
docker compose down && docker compose up -d
```

---

## Docker Compose (Odoo + Postgres)

```bash
cd /opt/basetaa-odoo-deploy

docker compose ps           # Status
docker compose logs odoo    # Odoo logs
docker compose logs db      # Postgres logs
docker compose restart odoo # Restart Odoo only
docker compose down         # Stop all
docker compose up -d        # Start all (detached)
```

### Container names
- `basetaa-odoo-deploy-odoo-1` — Odoo application
- `basetaa-odoo-deploy-db-1` — PostgreSQL 15

### PostgreSQL direct access
```bash
docker exec -it basetaa-odoo-deploy-db-1 psql -U odoo

# List all databases
\l

# Connect to control DB
\c basetaa_control

# List tenants
SELECT "normalizedSubdomain", status, "provisioningState", "odooDb"
FROM tenants
ORDER BY "createdAt" DESC;
```

---

## SSL / Let's Encrypt

```bash
# Check certificate expiry
certbot certificates

# Renew (usually handled automatically by systemd timer)
certbot renew --dry-run  # dry run first
certbot renew            # actual renewal

# Check certbot timer
systemctl status certbot.timer
```

Certificate covers: `erp.basetaa.com` + `*.erp.basetaa.com`

---

## Firewall

Confirm these ports are open on the server:
- 80 (HTTP, for HTTPS redirect)
- 443 (HTTPS)
- 22 (SSH)

Ports 3000 and 8069 should only be accessible on localhost (not externally). Verify:
```bash
ss -tlnp | grep -E "3000|8069"
# Should show *:3000 and *:8069 — these are fine, Nginx handles external filtering
```
