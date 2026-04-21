# Domain & URL Reference

---

## DNS Configuration

All domains point to a single server IP: **187.127.112.42**

| Record | Type | Value |
|---|---|---|
| `erp.basetaa.com` | A | 187.127.112.42 |
| `*.erp.basetaa.com` | A | 187.127.112.42 |
| `control.erp.basetaa.com` | A | 187.127.112.42 (via wildcard) |

The wildcard `*.erp.basetaa.com` covers all tenant subdomains (`acme.erp.basetaa.com`, `globex.erp.basetaa.com`, etc.) and also `control.erp.basetaa.com`.

---

## SSL Certificates

| Certificate | Covers | Provider | Renewal |
|---|---|---|---|
| `erp.basetaa.com` fullchain | apex + wildcard `*.erp.basetaa.com` | Let's Encrypt (Certbot) | Auto via certbot timer |

Certificate path on server: `/etc/letsencrypt/live/erp.basetaa.com/`

---

## URL Directory

### Public

| URL | Handler | Description |
|---|---|---|
| `https://erp.basetaa.com` | Next.js `/site` | Landing page |
| `https://erp.basetaa.com/signup` | Next.js `/site/signup` | Signup form |

### Admin Panel

| URL | Handler | Auth required |
|---|---|---|
| `https://control.erp.basetaa.com` | Next.js `/admin` | Yes (NextAuth) |
| `https://control.erp.basetaa.com/login` | Next.js `/admin/login` | Public |
| `https://control.erp.basetaa.com/tenants` | Next.js `/admin/tenants` | Yes |
| `https://control.erp.basetaa.com/tenants/{id}` | Next.js `/admin/tenants/[id]` | Yes |

### Tenant Workspaces

| URL pattern | Handler | Description |
|---|---|---|
| `https://{sub}.erp.basetaa.com` | Odoo :8069 (if active+ready) | Live Odoo workspace |
| `https://{sub}.erp.basetaa.com` | Next.js `/workspace/{sub}` (if not active) | Status page |
| `https://{sub}.erp.basetaa.com/web` | Odoo — direct app entry | Redirects to Odoo login |
| `https://{sub}.erp.basetaa.com/web/database/*` | Nginx `deny all` | Blocked externally |

### Internal API Endpoints

| Endpoint | Method | Called by | Auth |
|---|---|---|---|
| `/api/signup` | POST | Signup form | None (public) |
| `/api/tenant-gate` | GET | Nginx auth_request | `X-Nginx-Internal: 1` header |
| `/api/auth/*` | GET/POST | NextAuth | NextAuth internals |
| `/api/admin/tenants/{id}/activate` | POST | Admin panel | NextAuth session |
| `/api/admin/tenants/{id}/deactivate` | POST | Admin panel | NextAuth session |
| `/api/admin/tenants/{id}/reprovision` | POST | Admin panel | NextAuth session |

### Odoo Direct Endpoints (internal only, via localhost)

| Endpoint | Used for |
|---|---|
| `http://localhost:8069/web/health` | Health check |
| `http://localhost:8069/web/database/create` | Create tenant DB at provisioning |
| `http://localhost:8069/web/database/list` | Check if DB exists |
| `http://localhost:8069/web/database/drop` | Drop DB (not yet wired to UI) |
| `http://localhost:8069/xmlrpc/2/common` | Authenticate Odoo admin user |
| `http://localhost:8069/xmlrpc/2/object` | Write user credentials (execute_kw) |

---

## Nginx Server Blocks Summary

Three server blocks in `/etc/nginx/sites-enabled/basetaa-erp`:

1. **Platform block** — `listen 443 ssl; server_name erp.basetaa.com control.erp.basetaa.com;`
   - Proxies everything to `http://nextjs` (upstream to 127.0.0.1:3000)

2. **Tenant block** — `listen 443 ssl; server_name ~^(?P<sub>[a-z0-9]+)\.erp\.basetaa\.com$;`
   - Fires `auth_request /_tenant_gate` on every `/` request
   - 200 → proxy to Odoo, 403 → proxy to Next.js workspace page
   - Blocks `/web/database/*` externally

3. **HTTP redirect** — `listen 80; server_name erp.basetaa.com *.erp.basetaa.com;`
   - Returns 301 to HTTPS for all HTTP traffic

Full config: `docs/project-state/nginx-workspace.conf`
