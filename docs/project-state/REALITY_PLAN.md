# Reality Plan — Basetaa + Odoo Integration

> Status: Planning  
> Approved: 2026-04-21  
> Scope: Local workspace implementation only. No GitHub push. No server deployment.

---

## What the Reality Plan Is

The Reality Plan defines the fastest practical path from the current deployed Basetaa
shell to a working multi-tenant SaaS ERP product backed by Odoo.

**What the client experiences:**
1. Signs up at `erp.basetaa.com`
2. System provisions a dedicated Odoo database for their company
3. Their subdomain `acme.erp.basetaa.com` resolves directly to their Odoo workspace
4. They log in with credentials set at signup time
5. They see native Odoo — full ERP, no custom wrapper

**What Basetaa owns:**
- Public site and signup flow
- Tenant provisioning (Odoo DB creation, module installation)
- Subdomain → Odoo DB mapping
- Admin control panel (create, activate, deactivate, reprovision)
- Status pages for pending, inactive, and not-found states
- Auth/session is Odoo's own login for the workspace

**What the Reality Plan is NOT:**
- Not a custom ERP frontend that wraps Odoo
- Not direct Postgres writes to Odoo tables
- Not a unified auth system (workspace auth is Odoo's own login)
- Not the Dream Plan (custom UI + Odoo RPC backend) — that comes later

---

## Target Architecture

```
Browser
  │
  ▼
Nginx — SSL terminated, wildcard cert *.erp.basetaa.com
  │
  ├── erp.basetaa.com           → Next.js :3000  (public site + signup)
  ├── control.erp.basetaa.com   → Next.js :3000  (admin panel)
  │
  └── *.erp.basetaa.com         → [Nginx auth_request gateway]
          │
          ├── auth_request → GET http://localhost:3000/api/tenant-gate?sub={subdomain}
          │       returns 200 (active+ready)   → proxy to Odoo :8069
          │       returns 403 (inactive)       → proxy to Next.js :3000 (status page)
          │       returns 404 (not found)      → proxy to Next.js :3000 (not-found page)
          │       returns 202 (provisioning)   → proxy to Next.js :3000 (pending page)
          │
          ├── Active tenant → Odoo :8069
          │       Odoo dbfilter maps hostname → tenant database
          │       acme.erp.basetaa.com → database: tenant_acme
          │
          └── Non-active tenant → Next.js :3000 /workspace/{subdomain}
                  (existing pending/inactive/notfound pages)


Control Database (PostgreSQL — Basetaa Prisma)
  basetaa_control
    tenants table  — subdomain, odooDb, status, provisioningState, odooAdminPassword
    plans table    — unchanged

Odoo Databases (one per tenant, managed by Odoo)
  tenant_acme
  tenant_globex
  tenant_initech
  ...
```

---

## What Stays (No Changes Needed)

| Component | Notes |
|---|---|
| Middleware subdomain routing | Unchanged — still routes workspace URLs to `/workspace/{sub}` for non-active states |
| Nginx wildcard SSL config | One new server block added for workspace routing |
| PM2 + deployment pipeline | Unchanged |
| NextAuth admin auth | Unchanged — admin panel only |
| Prisma control DB | Add 3 fields to `Tenant`, no table changes |
| `src/app/site/` (landing + signup) | Unchanged — signup form stays the same |
| `src/app/admin/` (control panel) | Minor additions: show Odoo DB name, add reprovision button |
| Tailwind + branding | Unchanged |
| `subdomain.ts` + `buildDbName()` | Already generates `tenant_{subdomain}` — correct for Odoo |
| Workspace pending/inactive/notfound pages | Unchanged — shown when Odoo isn't ready |
| `src/app/api/admin/tenants/` action routes | Minor updates to call new provisioning logic |

---

## What Changes

### 1. Prisma Schema — 3 new fields on `Tenant`

```prisma
model Tenant {
  // existing fields unchanged ...

  // NEW: Odoo-specific fields
  odooDb            String?   // "tenant_acme" — Odoo database name (= current dbName value)
  odooAdminPassword String?   // generated at provision time, stored for service use
  odooModules       String[]  // modules installed, e.g. ["base", "mail", "sale"]
}
```

`dbName` stays in the schema for backward compatibility. `odooDb` holds the same value
going forward (`tenant_{normalizedSubdomain}`). Both are populated identically.

### 2. `src/lib/tenant-db.ts` — Replace body, keep interface

Current: creates a raw Postgres DB + seeds a `workspace_meta` table.  
New: calls Odoo's `/web/database/create` HTTP endpoint to create an Odoo database.

The exported function signatures remain the same so `provisioning.ts` needs minimal changes:
- `createTenantDatabase(dbName)` → calls Odoo database creation API
- `tenantDatabaseExists(dbName)` → queries Odoo's database list API
- `seedTenantDatabase()` → removed or becomes a no-op (Odoo seeds itself on creation)

### 3. `src/lib/provisioning.ts` — Update step 8

Replace the raw DB creation + seed call with the Odoo provisioning flow.
Everything else (validation, uniqueness check, Prisma record creation, error handling) is unchanged.

New step 8:
```
createTenantDatabase(dbName)  →  Odoo POST /web/database/create
                                  { master_pwd, name, login, password, lang, country_code }
```

After creation, store `odooAdminPassword` in the Tenant record.

### 4. `src/app/workspace/[subdomain]/page.tsx` — Replace active-state render

Current: renders `<WorkspaceHome>` for active tenants.  
New: when `provisioningState === 'ready'` and `status` is `trial` or `active`,
     return an HTTP redirect to Odoo's login page at the same subdomain.

```typescript
// Instead of <WorkspaceHome>:
// This path is only hit if Nginx auth_request passes to Next.js (shouldn't happen for active)
// Kept as fallback:
redirect(`https://${tenant.fullDomain}/web`)
```

In practice, active tenants never reach this code — Nginx routes them directly to Odoo.
This is a safety fallback only.

### 5. New file: `src/app/api/tenant-gate/route.ts`

The Nginx `auth_request` endpoint. Called server-side by Nginx on every workspace request.

```
GET /api/tenant-gate?sub=acme

Returns:
  200   tenant is active and ready → Nginx proxies to Odoo
  202   tenant is provisioning/pending → Nginx serves Next.js pending page
  403   tenant is inactive → Nginx serves Next.js inactive page
  404   tenant not found → Nginx serves Next.js not-found page
```

This is a lightweight DB check — no body, just status code and a header:
`X-Odoo-Db: tenant_acme`  (Nginx can forward this to Odoo if needed)

### 6. Nginx — New workspace server block

Add a separate server block for `*.erp.basetaa.com` (excluding `erp` and `control`):
- Uses `auth_request` to check tenant status
- On 200: proxies to Odoo port 8069
- On non-200: falls back to Next.js for status pages

Full Nginx spec in `ODOO_TENANT_MAPPING_SPEC.md`.

### 7. Odoo Configuration — dbfilter + master password

Two changes to `odoo.conf` on the server:
1. Set `dbfilter = ^tenant_%d$` so Odoo selects the correct DB per subdomain
2. Confirm `admin_passwd` (master password) is set — used for DB creation API calls

`%d` in Odoo = the first subdomain component of the hostname.
`acme.erp.basetaa.com` → `%d` = `acme` → filter matches `tenant_acme`.

---

## Admin Actions — What Each Does

### Create Tenant (signup flow)
1. Validate input
2. Create Prisma `Tenant` record (`provisioningState: provisioning`)
3. Call Odoo `POST /web/database/create` with `name=tenant_{subdomain}`
4. Store generated `odooAdminPassword` in Tenant record
5. Mark `provisioningState: ready`, `status: trial`, `isActive: true`
6. On failure: mark `provisioningState: failed`, store `provisioningError`

### Activate (admin panel)
- Sets `status: active`, `isActive: true`
- Requires `provisioningState: ready` (guard already exists)
- No Odoo DB action needed — tenant DB already exists

### Deactivate (admin panel)
- Sets `status: inactive`, `isActive: false`
- No Odoo DB action — DB stays intact, Nginx gateway blocks access
- Tenant data preserved for reactivation

### Reprovision (admin panel — for failed tenants)
1. Check if Odoo DB already exists (`tenantDatabaseExists`)
2. If not: call Odoo `POST /web/database/create` again
3. If yes: skip creation, just mark ready (DB may be partially set up)
4. Mark `provisioningState: ready`

### Delete Tenant (admin panel — future, not in this phase)
- Requires explicit confirmation
- Drops Odoo database via `POST /web/database/drop`
- Deletes Prisma Tenant record

---

## Failure Handling

| Failure | Behavior |
|---|---|
| Odoo DB creation fails | `provisioningState: failed`, `provisioningError` stored, admin can reprovision |
| Odoo unreachable at provision time | Same as above — fail gracefully, do not crash signup |
| Nginx auth_request times out | Nginx falls back to Next.js (configured with `error_page`) |
| Tenant DB exists but Odoo says missing | `tenantDatabaseExists` checks Odoo list API — no false positives |
| Odoo master password wrong | API returns error — surfaced in `provisioningError` field |
| Concurrent signup with same subdomain | Existing P2002 guard in `provisioning.ts` handles this |

---

## Environment Variables to Add

```bash
# Odoo connection (server-side only, never exposed to browser)
ODOO_URL="http://localhost:8069"
ODOO_MASTER_PASSWORD="<the master_password from odoo.conf>"
```

Add to `.env.example` (without values) and to server `.env.local`.

---

## What to Do Locally Before GitHub

In order:

1. Update Prisma schema — add `odooDb`, `odooAdminPassword`, `odooModules` fields
2. Create `src/lib/odoo-db.ts` — Odoo database creation/existence check via HTTP
3. Update `src/lib/tenant-db.ts` to delegate to `odoo-db.ts`
4. Update `src/lib/provisioning.ts` — store `odooDb` and `odooAdminPassword`
5. Create `src/app/api/tenant-gate/route.ts` — Nginx auth_request endpoint
6. Update workspace `page.tsx` — remove WorkspaceHome, add redirect fallback
7. Add `ODOO_URL` and `ODOO_MASTER_PASSWORD` to `.env.example`
8. Update `.env.local` on server (approval required before server changes)
9. Write Nginx config diff (prepared locally, applied on server after approval)
10. Write Odoo conf diff (prepared locally, applied on server after approval)

See `REALITY_IMPLEMENTATION_CHECKLIST.md` for the full ordered task list.
