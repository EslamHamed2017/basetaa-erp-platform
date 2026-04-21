# System Architecture

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend / App | Next.js (App Router) | 14.2.5 |
| Runtime | Node.js | 24.x |
| ORM | Prisma | 5.16.1 |
| Control DB | PostgreSQL | 15 (Docker) |
| Tenant DBs | PostgreSQL | 15 (Docker, managed by Odoo) |
| ERP Backend | Odoo Community | 17.0-20260409 |
| Process manager | PM2 | latest |
| Reverse proxy | Nginx | 1.24.0 |
| SSL | Let's Encrypt (Certbot) | wildcard via DNS challenge |
| Containerization | Docker + Docker Compose | 29.4.0 / v5.1.3 |
| OS | Ubuntu | 24.04.4 LTS |

---

## Component Map

```
Browser
  │
  ▼
Nginx (port 443, SSL terminated)
  │
  ├── erp.basetaa.com ──────────────────────────► Next.js :3000
  │   control.erp.basetaa.com ─────────────────► Next.js :3000
  │
  └── *.erp.basetaa.com (tenant subdomains)
          │
          ├── auth_request → Next.js /api/tenant-gate?sub={subdomain}
          │       200 (trial or active + ready) → proxy to Odoo :8069
          │       403 (all other states)        → proxy to Next.js :3000
          │
          ├── Active/trial tenant → Odoo :8069
          │       Odoo dbfilter: ^tenant_%d$
          │       acme.erp.basetaa.com → tenant_acme
          │
          └── Non-active tenant → Next.js /workspace/{subdomain}
                  (pending / inactive / not-found pages)


Next.js :3000
  ├── /site/*           Public site + signup form
  ├── /admin/*          Control panel (NextAuth protected)
  ├── /workspace/*      Tenant status pages (pending, inactive, not-found)
  ├── /api/signup       POST — tenant provisioning
  ├── /api/tenant-gate  GET  — Nginx auth_request endpoint
  └── /api/admin/*      Admin actions (activate, deactivate, reprovision)


PostgreSQL (Docker, port 5432)
  ├── basetaa_control   Prisma control DB (tenants, plans, feature_flags)
  ├── odoo              Default Odoo DB (unused by tenants)
  ├── tenant_acme       Tenant workspace DB (owned and managed by Odoo)
  ├── tenant_globex     ...
  └── ...


Odoo (Docker, port 8069)
  ├── Serves all tenant DBs filtered by hostname
  ├── dbfilter = ^tenant_%d$  (%d = first subdomain component)
  ├── list_db = True          (required for DB creation API)
  └── admin_passwd            (master password for DB management API)
```

---

## Middleware Routing (Next.js)

File: `src/middleware.ts`

| Host | Middleware action |
|---|---|
| `erp.basetaa.com` | Rewrite `/` → `/site`, `/signup` → `/site/signup`, etc. |
| `control.erp.basetaa.com` | Rewrite `/` → `/admin`, `/tenants` → `/admin/tenants`, etc. |
| `acme.erp.basetaa.com` | Rewrite `/` → `/workspace/acme/` (only hit if Nginx gate fails) |
| `localhost` | Public site (bare localhost) |

Reserved subdomains (`erp`, `www`, `control`, `api`, `mail`, `ftp`, `admin`) are treated as public site even if they somehow reach the tenant branch.

---

## Data Flow: Tenant Provisioning

```
POST /api/signup
  │
  ├── Validate input (zod schema)
  ├── Validate subdomain format
  ├── Check email + subdomain uniqueness
  ├── Resolve plan pricing from DB
  ├── Hash password (bcrypt, 12 rounds)
  ├── Create Tenant record (status=pending, provisioningState=provisioning)
  │
  ├── generateOdooAdminPassword() — crypto.randomBytes(24).toString('base64url')
  ├── tenantDatabaseExists(dbName) — check Odoo /web/database/list
  ├── createTenantDatabase(dbName, adminPassword)
  │       POST /web/database/create → Odoo HTTP API
  │       Odoo creates PostgreSQL DB + seeds with base module (~12s)
  │
  ├── setOdooTenantCredentials(dbName, adminPassword, email, password)
  │       POST /xmlrpc/2/common  → authenticate as admin → get UID
  │       POST /xmlrpc/2/object  → execute_kw res.users write
  │                               → set login=email, email=email, password=signupPassword
  │
  └── prisma.tenant.update(status=trial, provisioningState=ready, odooDb, odooAdminPassword)
        → Return {success, workspaceUrl}
```

---

## Data Flow: Tenant Request Routing

```
GET https://acme.erp.basetaa.com/web
  │
  ├── Nginx matches *.erp.basetaa.com server block
  ├── Nginx fires: auth_request /_tenant_gate
  │       → subrequest: GET http://localhost:3000/api/tenant-gate?sub=acme
  │                     with header: X-Nginx-Internal: 1
  │
  ├── tenant-gate: SELECT status, provisioningState, odooDb FROM tenants WHERE normalizedSubdomain='acme'
  │       → trial or active + ready → return 200 (header: X-Odoo-Db: tenant_acme)
  │       → anything else           → return 403
  │
  ├── 200 → Nginx proxies to Odoo :8069 with original Host header
  │       → Odoo dbfilter matches 'acme' → serves tenant_acme
  │
  └── 403 → Nginx routes to Next.js /workspace/acme
              → page shows pending/inactive/not-found state
```

---

## Key Source Files

| File | Purpose |
|---|---|
| `src/middleware.ts` | Subdomain → app route mapping |
| `src/lib/provisioning.ts` | Main tenant provisioning orchestrator |
| `src/lib/odoo-db.ts` | Odoo HTTP + XML-RPC client |
| `src/lib/tenant-db.ts` | Thin wrapper delegating to odoo-db.ts |
| `src/lib/subdomain.ts` | Subdomain validation, normalization, buildDbName() |
| `src/app/api/signup/route.ts` | POST /api/signup handler |
| `src/app/api/tenant-gate/route.ts` | GET /api/tenant-gate Nginx auth endpoint |
| `src/app/admin/tenants/[id]/page.tsx` | Tenant detail page (admin) |
| `src/app/admin/tenants/[id]/TenantActions.tsx` | Activate/deactivate/reprovision buttons |
| `prisma/schema.prisma` | Control DB schema |
| `docs/project-state/nginx-workspace.conf` | Full Nginx config (deployed) |
