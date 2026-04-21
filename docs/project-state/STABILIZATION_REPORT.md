# Stabilization Report — Reality Plan Live Test

> Date: 2026-04-21 (updated 2026-04-21)  
> Stage: Internal real-user testing ready  
> Author: Basetaa Engineering

---

## What Was Verified

The Reality Plan end-to-end flow is operational on `187.127.112.42`:

| Step | Result |
|---|---|
| User signs up at `erp.basetaa.com` | ✅ |
| Control DB `Tenant` record created with `status=pending/provisioning` | ✅ |
| Odoo database `tenant_{subdomain}` created via HTTP API (~12 seconds) | ✅ |
| Tenant record updated to `status=trial`, `provisioningState=ready` | ✅ |
| `odooDb` and `odooAdminPassword` stored on Tenant record | ✅ |
| Nginx auth_request gate returns 200 for trial/ready tenant | ✅ |
| `{subdomain}.erp.basetaa.com` proxied to Odoo | ✅ |
| Odoo serves correct database per subdomain (dbfilter) | ✅ |
| Unknown tenant → 403 from gate → Next.js workspace page | ✅ |

---

## Live Infrastructure State (as of 2026-04-21)

### Server: 187.127.112.42

| Component | Status | Notes |
|---|---|---|
| Nginx | Active | Wildcard SSL `*.erp.basetaa.com` + apex `erp.basetaa.com` |
| PM2 `basetaa-erp` | Online | Next.js 14 on port 3000 |
| Odoo (Docker) | Healthy | Port 8069, `dbfilter=^tenant_%d$`, `list_db=True` |
| PostgreSQL (Docker) | Healthy | Port 5432, hosts control DB + tenant DBs |

### odoo.conf (current)

```ini
dbfilter = ^tenant_%d$
admin_passwd = [redacted — stored in /opt/basetaa-odoo-deploy/config/odoo.conf on server]
list_db = True
workers = 0
log_level = info
proxy_mode = True
```

### DNS

| Domain | Record | Resolves |
|---|---|---|
| `erp.basetaa.com` | A → 187.127.112.42 | ✅ |
| `control.erp.basetaa.com` | A → 187.127.112.42 (wildcard) | ✅ |
| `*.erp.basetaa.com` | A → 187.127.112.42 | ✅ |

---

## Test Data — What Exists on the Server

### Control DB (`basetaa_control.tenants`)

| Subdomain | Status | Provisioning State | Odoo DB | Notes |
|---|---|---|---|---|
| `test1` | trial | ready | NULL | Pre-Reality Plan — provisioned with old flow. `odooDb` NULL; gate uses `tenant_${sub}` fallback. Functional. |
| `geo` | active | ready | NULL | Same as above. |
| `huss` | pending | failed | — | Old failed attempt, pre-Reality Plan. `provisioningError: password authentication failed` |
| `hus` | pending | failed | — | Same. |
| `fhf` | pending | failed | — | Same. |
| `testco` | trial | ready | `tenant_testco` | Live test tenant. Fully provisioned with new flow. |

### Odoo PostgreSQL Databases

| Database | Purpose | Keep? |
|---|---|---|
| `odoo` | Default Odoo DB (unused by tenants) | Keep — default install artifact |
| `basetaa_control` | Basetaa control DB (Prisma) | Keep — production |
| `tenant_test1` | Old test tenant | Keep for now — `test1` tenant record references it |
| `tenant_geo` | Real tenant (geo) | Keep — active tenant |
| `tenant_testco` | Reality Plan live test tenant | Keep — useful for ongoing verification |
| `probe_phone_test` | Created during debugging session | **Safe to drop** — orphaned, no tenant record |

---

## Cleanup Items

### Must Do Before Real Users

| Item | Priority | Action |
|---|---|---|
| ~~**Odoo login credentials not given to user**~~ | ✅ Done | Credential handoff implemented (`b1644f9`). After signup, Odoo admin user's login/email/password are set to the user's signup credentials via XML-RPC. |
| ~~Admin panel: show `odooDb` field~~ | ✅ Done | Tenant detail page now shows Odoo DB, modules, workspace URL, and login email. |
| `probe_phone_test` Odoo DB | Low | Drop — orphaned debug artifact. `docker exec basetaa-odoo-deploy-db-1 dropdb -U odoo probe_phone_test` |

### Nice to Do (Not Blocking)

| Item | Priority | Action |
|---|---|---|
| `huss`, `hus`, `fhf` failed records | Low | Can be deleted from control DB — old failed pre-Reality Plan attempts |
| `test1` and `geo` — backfill `odooDb` | Low | Set `odooDb = dbName` for these two so gate uses stored value not fallback |
| Nginx `proxy_read_timeout` for provisioning | Low | Current Next.js → Odoo provisioning bypasses Nginx; if moved to API route through Nginx, 60s timeout will fail for 60s+ DB creations |

---

## Credential Handoff — Resolved ✅

**What happens now:**
1. User signs up → Odoo DB created with `login=admin`, `password={random 24-byte base64url}`
2. Immediately after DB creation, `setOdooTenantCredentials()` is called via XML-RPC
3. Odoo admin user's `login`, `email`, and `password` are updated to the user's signup credentials
4. User visits `acme.erp.basetaa.com` → logs in with their signup email and password

Implemented in `src/lib/odoo-db.ts` (`setOdooTenantCredentials`) and wired in `src/lib/provisioning.ts`.
Verified live: tenant `credtest0592` — XML-RPC auth with signup credentials returned UID `2`. ✅

---

## Internal Testing Readiness

| Check | Status |
|---|---|
| End-to-end provisioning works | ✅ |
| Subdomain routing works | ✅ |
| Auth_request gate works | ✅ |
| Inactive/pending state pages work | ✅ |
| SSL covers all domains | ✅ |
| DNS resolves for all domains | ✅ |
| User can log into Odoo after signup | ✅ Signup credentials work directly in Odoo |
| Admin can see Odoo DB assignment | ✅ Shown in tenant detail page |

**Verdict: Ready for internal real-user testing.** Users sign up, get a workspace, and log in with the same credentials used at signup. No manual DB access required.

---

## Recommended Next Stage

### Stage: Internal Real-User Testing ← current

All blocking issues are resolved. Run the first internal end-to-end signup:

1. A team member goes to `erp.basetaa.com` and signs up with real credentials
2. Waits ~15 seconds for provisioning
3. Visits `{subdomain}.erp.basetaa.com` — should redirect to Odoo login
4. Logs in with their signup email and password
5. Confirms they see their company's Odoo workspace
6. Admin panel at `control.erp.basetaa.com/admin/tenants` confirms the tenant record

After passing: open to wider internal team, then external beta.

### Then: Async Provisioning (after internal testing validates the flow)

The current ~15-second synchronous signup will degrade under load or for slower DB creation (Odoo can take 60+ seconds on a cold server). Next improvement:
- Create tenant record immediately (return `workspaceUrl` to user)
- Spin off DB creation as a background job (queue, worker, or simple async)
- Show a "provisioning in progress" page at the subdomain until ready
- The workspace page + pending state already exists for this case
