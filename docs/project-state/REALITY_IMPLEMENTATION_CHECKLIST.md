# Reality Plan — Implementation Checklist

> Status: **Complete** — all phases shipped and verified live on 2026-04-21  
> Commits: `5b5e081` (Reality Plan), `7ba633b` (provisioning bug fixes), `b1644f9` (credential handoff), `HEAD` (admin panel Odoo visibility)

---

## Phase 0 — Prerequisites

- [x] Odoo running on server: health check passes (`{"status":"pass"}`)
- [x] Odoo master password confirmed: `[redacted — see SECRETS_INDEX.md]` (in `odoo.conf`)
- [x] `list_db = True` confirmed (was `False`, reverted — see Bug 1 below)
- [x] Nginx `ngx_http_auth_request_module` present and configured
- [x] `ODOO_URL` and `ODOO_MASTER_PASSWORD` added to server `.env.local`

---

## Phase 1 — Schema

- [x] **1.1** Added to `prisma/schema.prisma`:
  - `odooDb String?`
  - `odooAdminPassword String?`
  - `odooModules String[] @default([])`
- [x] **1.2** Prisma client regenerated on server via `prisma db push`
- [x] **1.3** Migration applied to production `basetaa_control` DB — all 3 columns live
- [x] **1.4** `buildDbName()` confirmed correct — produces `tenant_{sub}`

---

## Phase 2 — Odoo HTTP Client

- [x] **2.1** `createOdooDatabase(dbName, adminPassword)` — implemented and verified
  - **Bug found in live test:** Odoo 17 requires `phone` field; response HTML not detected as error
  - **Fixed in `7ba633b`:** added `phone=''`, `country_code=AE`; added `'Database creation error'` detection
- [x] **2.2** `odooDatabaseExists(dbName)` — implemented
  - **Known limitation:** returns `false` when `list_db=False` blocks list endpoint
  - **Mitigated:** `createTenantDatabase` treats "already exists" as success for safe re-provisioning
- [x] **2.3** `dropOdooDatabase(dbName)` — implemented, not yet wired to admin UI
- [x] **2.4** `generateOdooAdminPassword()` — `crypto.randomBytes(24).toString('base64url')`

---

## Phase 3 — Provisioning Layer

- [x] **3.1** `src/lib/tenant-db.ts` — raw Postgres logic removed, delegates to `odoo-db.ts`
- [x] **3.2** `src/lib/provisioning.ts` — stores `odooDb`, `odooAdminPassword`, `odooModules: ['base']`
- [x] **3.3** `.env.example` — `ODOO_URL` and `ODOO_MASTER_PASSWORD` documented
- [x] **3.4** TypeScript build: zero errors

---

## Phase 4 — tenant-gate Endpoint

- [x] **4.1** `GET /api/tenant-gate?sub={subdomain}` implemented
  - Returns `200` (active+ready) or `403` (everything else)
  - Note: simplified from spec — 202/404 collapsed to 403; Next.js workspace page handles UI state
- [x] **4.2** Protected by `X-Nginx-Internal: 1` header check
- [x] **4.3** Verified: returns 403 for unknown tenants, 403 without internal header

---

## Phase 5 — Workspace Page

- [x] **5.1** `WorkspaceHome` removed; active+ready tenants redirect to `https://${tenant.fullDomain}/web`
- [x] **5.2** Pending/inactive/notFound pages unchanged

---

## Phase 6 — Admin Panel Updates

- [x] **6.1** Tenant detail page now shows `odooDb`, `odooModules`, workspace URL, and login email
- [ ] **6.2** Reprovision route does not yet update `odooDb`/`odooAdminPassword` on retry — deferred
- [x] **6.3** Admin visibility sufficient for internal testing support

---

## Phase 7 — Local E2E Verification

- [x] **7.1** `npm run build` — zero errors
- [x] **7.2** `prisma generate` — client updated
- [x] **7.4** Full signup flow tested live against production server:
  - `testco` signed up → `tenant_testco` created → `trial/ready` → HTTP 200 from Odoo ✅
- [x] **7.5** tenant-gate endpoint responses verified for unknown/missing tenants

---

## Phase 8 — Server Config

- [x] **8.1** Nginx workspace server block written to `docs/project-state/nginx-workspace.conf` and deployed
  - Tenant server block: auth_request gate + `/web/database/*` external deny
- [x] **8.2** Odoo config applied:
  - `dbfilter = ^tenant_%d$`
  - `list_db = True` (initially set False, reverted after Bug 1 discovery)
  - `admin_passwd` confirmed
  - `list_db = False` removed
  - `proxy_mode = True`

---

## Phases 9–12 — Approval, GitHub, Deployment, Verification

- [x] **Phase 9** — Approval granted
- [x] **Phase 10** — Pushed to GitHub (`main`)
- [x] **Phase 11** — Server deployment complete
- [x] **Phase 12** — Live verification passed:
  - `testco.erp.basetaa.com` → Nginx → Odoo → `<title>Odoo</title>` — HTTP 200 ✅

---

## Bugs Found During Live Test (2026-04-21)

| # | Bug | Commit |
|---|---|---|
| 1 | `list_db=False` blocked `/web/database/create` API | `7ba633b` |
| 2 | Odoo 17 requires `phone` param in create POST — silently failed | `7ba633b` |
| 3 | `createOdooDatabase` returned `{success:true}` on unrecognized error HTML | `7ba633b` |
| 4 | `odooDatabaseExists` always returns false when list endpoint blocked | `7ba633b` |

---

## Current Status

| Phase | Status |
|---|---|
| 0 — Prerequisites | ✅ Complete |
| 1 — Schema | ✅ Complete |
| 2 — Odoo HTTP Client | ✅ Complete (bugs fixed) |
| 3 — Provisioning Layer | ✅ Complete |
| 4 — tenant-gate Endpoint | ✅ Complete |
| 5 — Workspace Page | ✅ Complete |
| 6 — Admin Panel | ✅ Complete — Odoo DB, modules, workspace URL, login shown |
| 7 — Local E2E Verification | ✅ Complete (run live on server) |
| 8 — Server Config Prep | ✅ Complete |
| 9 — Approval Gate | ✅ Approved |
| 10 — GitHub Push | ✅ Pushed |
| 11 — Server Deployment | ✅ Deployed |
| 12 — Live Verification | ✅ Passed |
