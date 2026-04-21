# Reality Plan — Implementation Checklist

> Workflow: Local → Verify → Approve → GitHub → Deploy  
> Do not push or deploy until each local phase is verified.

---

## Phase 0 — Prerequisites (verify before writing code)

- [ ] Confirm Odoo is running on the server: `curl -s http://localhost:8069/web/health`
- [ ] Confirm Odoo master password is known (`admin_passwd` in `odoo.conf`)
- [ ] Confirm Odoo `list_db` is NOT disabled (needed for DB creation API)
- [ ] Confirm Nginx has `ngx_http_auth_request_module` compiled in: `nginx -V 2>&1 | grep auth_request`
- [ ] Add `ODOO_URL` and `ODOO_MASTER_PASSWORD` to local `.env.local` for testing
- [ ] Confirm server `.env.local` will need updating (approval required before touching server)

---

## Phase 1 — Schema (local only)

- [ ] **1.1** Add fields to `prisma/schema.prisma`:
  - `odooDb String?`
  - `odooAdminPassword String?`
  - `odooModules String[] @default([])`
- [ ] **1.2** Run `prisma generate` locally to update client types
- [ ] **1.3** Create migration file: `prisma migrate dev --name add_odoo_fields`
  - Do NOT apply to production DB yet — approval required
- [ ] **1.4** Verify `buildDbName()` in `subdomain.ts` still produces `tenant_{sub}` — no change needed ✓

---

## Phase 2 — Odoo HTTP Client (local only)

Create `src/lib/odoo-db.ts` — all Odoo HTTP operations, no Prisma imports.

- [ ] **2.1** `createOdooDatabase(dbName, adminPassword)` 
  - POST to `ODOO_URL/web/database/create` (form-encoded)
  - Params: `master_pwd`, `name`, `login=admin`, `password`, `lang=en_US`, `country_code`
  - Returns: `{ success: boolean; error?: string }`
- [ ] **2.2** `odooDatabaseExists(dbName)`
  - POST to `ODOO_URL/web/database/list` 
  - Returns: `boolean`
- [ ] **2.3** `dropOdooDatabase(dbName, masterPassword)`
  - POST to `ODOO_URL/web/database/drop`
  - Returns: `{ success: boolean }`
  - Note: used only from admin delete action — not yet wired to UI in this phase
- [ ] **2.4** Generate a secure random password for Odoo admin user
  - Simple: `crypto.randomBytes(24).toString('base64url')`
- [ ] **2.5** Unit test manually: call `odooDatabaseExists('odoo')` against local/server Odoo
  - Use a one-off test script `scripts/test-odoo-db.ts`

---

## Phase 3 — Update Provisioning Layer (local only)

- [ ] **3.1** Update `src/lib/tenant-db.ts`:
  - Replace `createTenantDatabase(dbName)` body — call `createOdooDatabase()` instead of raw Postgres `CREATE DATABASE`
  - Replace `tenantDatabaseExists(dbName)` body — call `odooDatabaseExists()` instead of `pg_database` query
  - Remove `seedTenantDatabase()` — Odoo seeds itself on creation. Replace with no-op or delete
  - Keep `getTenantPool()` export as-is (used nowhere in Reality Plan but kept for future)
- [ ] **3.2** Update `src/lib/provisioning.ts`:
  - After `createTenantDatabase(dbName)` succeeds: generate `odooAdminPassword`
  - Add to Prisma update after provisioning:
    ```typescript
    odooDb: dbName,
    odooAdminPassword: generatedPassword,
    odooModules: ['base'],
    ```
  - Update `reprovisionTenant()` the same way
- [ ] **3.3** Add `ODOO_URL` and `ODOO_MASTER_PASSWORD` to `.env.example` (no values, just keys + comments)
- [ ] **3.4** Verify TypeScript compiles: `npm run build` locally

---

## Phase 4 — Nginx Auth-Request Endpoint (local only)

Create `src/app/api/tenant-gate/route.ts`

- [ ] **4.1** Implement `GET /api/tenant-gate?sub={subdomain}`
  - Query: `prisma.tenant.findUnique({ where: { normalizedSubdomain: sub } })`
  - Returns:
    - `200` + header `X-Odoo-Db: tenant_{sub}` — if `provisioningState === 'ready'` AND `status` is `trial` or `active`
    - `202` — if `status === 'pending'` OR `provisioningState` is `pending/provisioning`
    - `403` — if `status === 'inactive'`
    - `404` — if tenant not found
  - No response body — Nginx only cares about the status code
- [ ] **4.2** Protect from direct browser access: check `x-nginx-internal` header
  - Nginx will set this header on auth_request calls
  - If header missing, return 403 (prevents scraping tenant status publicly)
- [ ] **4.3** Test endpoint manually with curl:
  ```bash
  curl -s -o /dev/null -w '%{http_code}' \
    -H 'x-nginx-internal: 1' \
    'http://localhost:3000/api/tenant-gate?sub=test'
  ```
- [ ] **4.4** Verify TypeScript compiles

---

## Phase 5 — Workspace Page Update (local only)

- [ ] **5.1** Update `src/app/workspace/[subdomain]/page.tsx`:
  - Remove `import WorkspaceHome` and its render
  - For `provisioningState === 'ready'` AND active status: add `redirect()` to Odoo URL as fallback
    ```typescript
    // Fallback only — Nginx normally handles active tenants directly
    redirect(`https://${tenant.fullDomain}/web`)
    ```
  - Keep all other status checks (inactive, pending, notFound) exactly as-is
- [ ] **5.2** `WorkspaceHome.tsx` — keep file, do not delete (will be reused in Dream Plan)
- [ ] **5.3** Full build check: `npm run build`

---

## Phase 6 — Admin Panel Updates (local only)

- [ ] **6.1** Update tenant detail page `src/app/admin/tenants/[id]/page.tsx`:
  - Show `odooDb` value if set (e.g., "Odoo DB: tenant_acme")
  - Show `odooAdminPassword` masked with a copy button (optional, useful for debugging)
- [ ] **6.2** Update `src/app/api/admin/tenants/[id]/reprovision/route.ts`:
  - After successful reprovision: store `odooDb` and `odooAdminPassword` if not already set
- [ ] **6.3** Verify all admin API routes still compile and work

---

## Phase 7 — Local End-to-End Verification

Before any server or GitHub work:

- [ ] **7.1** Run `npm run build` — zero errors
- [ ] **7.2** Run `prisma generate` — client types updated
- [ ] **7.3** Test `odooDatabaseExists('odoo')` against server Odoo via SSH tunnel or direct
  - `ssh -L 8069:localhost:8069 root@187.127.112.42` then test locally
- [ ] **7.4** Test full signup flow with Odoo DB creation:
  - Run dev server: `npm run dev`
  - Sign up via `erp.basetaa.com/signup` (or POST to `/api/signup`)
  - Verify Odoo database was created on server
  - Verify Tenant record has `odooDb` and `odooAdminPassword` set
  - Verify `provisioningState: ready`
- [ ] **7.5** Test `tenant-gate` endpoint responses for each status code
- [ ] **7.6** Confirm no TypeScript errors: `npx tsc --noEmit`

---

## Phase 8 — Server Config Preparation (local — do NOT apply yet)

Prepare config files locally. Apply only after approval.

- [ ] **8.1** Write Nginx workspace server block to `docs/project-state/nginx-workspace.conf`
  - Full spec in `ODOO_TENANT_MAPPING_SPEC.md`
  - Do NOT apply to server yet
- [ ] **8.2** Write Odoo config diff to `docs/project-state/odoo-conf-diff.txt`
  - Add `dbfilter = ^tenant_%d$`
  - Confirm `admin_passwd` line
  - Do NOT apply to server yet
- [ ] **8.3** Review both config files manually

---

## Phase 9 — Approval Gate

**Stop here. The following require explicit approval before proceeding:**

- [ ] Prisma migration applied to production DB
- [ ] Server `.env.local` updated with `ODOO_URL` and `ODOO_MASTER_PASSWORD`
- [ ] Nginx workspace server block applied and reloaded
- [ ] Odoo `odoo.conf` updated with `dbfilter`
- [ ] GitHub push

---

## Phase 10 — GitHub Push (after approval)

- [ ] `git add` all changed files (exclude `.env.local`, `*.local`, generated files)
- [ ] Commit with message: `feat: reality plan — odoo tenant provisioning`
- [ ] Push to `main`

---

## Phase 11 — Server Deployment (after approval)

- [ ] SSH into server
- [ ] `git pull origin main`
- [ ] Update `.env.local` with `ODOO_URL` + `ODOO_MASTER_PASSWORD`
- [ ] Run Prisma migration: `set -a && source .env.local && set +a && npx prisma migrate deploy`
- [ ] `npm run build`
- [ ] `pm2 restart basetaa-erp`
- [ ] Apply Nginx workspace server block: write file, `nginx -t`, `systemctl reload nginx`
- [ ] Update Odoo conf: add `dbfilter`, restart Odoo container
- [ ] Health check all three routes

---

## Phase 12 — Live Verification

- [ ] Sign up a test tenant through `erp.basetaa.com/signup`
- [ ] Verify Odoo database created: check via admin panel or server
- [ ] Open `{test-subdomain}.erp.basetaa.com` — should show Odoo login page
- [ ] Log in with generated credentials — should reach Odoo workspace
- [ ] Deactivate tenant from admin panel — should show Basetaa inactive page
- [ ] Reactivate — should go back to Odoo
- [ ] Reprovision a failed tenant — should recreate Odoo DB

---

## Current Status

| Phase | Status |
|---|---|
| 0 — Prerequisites | Not started |
| 1 — Schema | Not started |
| 2 — Odoo HTTP Client | Not started |
| 3 — Provisioning Layer | Not started |
| 4 — tenant-gate Endpoint | Not started |
| 5 — Workspace Page | Not started |
| 6 — Admin Panel | Not started |
| 7 — Local E2E Verification | Not started |
| 8 — Server Config Prep | Not started |
| 9 — Approval Gate | Pending |
| 10 — GitHub Push | Pending approval |
| 11 — Server Deployment | Pending approval |
| 12 — Live Verification | Pending |
