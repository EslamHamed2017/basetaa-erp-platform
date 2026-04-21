# Stabilization Report — Reality Plan Live Test

> Date: 2026-04-21  
> Stage: Post-launch stabilization  
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
admin_passwd = SO2vU9bhg94ziArC2ComWi5s
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
| **Odoo login credentials not given to user** | 🔴 Critical | After signup, the user arrives at Odoo login but doesn't know their credentials. The `odooAdminPassword` is stored in DB but never shown. See "Credential Gap" below. |
| `probe_phone_test` Odoo DB | Low | Drop — orphaned debug artifact. `docker exec basetaa-odoo-deploy-db-1 dropdb -U odoo probe_phone_test` |
| Admin panel: show `odooDb` field | Medium | Tenant detail page should show which Odoo DB is assigned |
| Admin panel: show/copy `odooAdminPassword` | Medium | Needed for admin to manually assist users with first login |

### Nice to Do (Not Blocking)

| Item | Priority | Action |
|---|---|---|
| `huss`, `hus`, `fhf` failed records | Low | Can be deleted from control DB — old failed pre-Reality Plan attempts |
| `test1` and `geo` — backfill `odooDb` | Low | Set `odooDb = dbName` for these two so gate uses stored value not fallback |
| Nginx `proxy_read_timeout` for provisioning | Low | Current Next.js → Odoo provisioning bypasses Nginx; if moved to API route through Nginx, 60s timeout will fail for 60s+ DB creations |

---

## Critical Gap: Odoo Login Credentials

This is the only blocking issue for real-user testing.

**What happens today:**
1. User signs up → Odoo DB created with `login=admin`, `password={random 24-byte base64url}`
2. User visits `acme.erp.basetaa.com` → sees Odoo login page
3. User has no idea what credentials to enter

**What the user needs:**
- Their email address as login, and a password they chose at signup
- OR: a link/page that tells them their initial credentials

**Options (in order of effort):**

| Option | Effort | Notes |
|---|---|---|
| A. After DB creation, call Odoo XML-RPC to set admin user's email + password | Medium | Most seamless — user's signup creds work in Odoo directly |
| B. Show the generated Odoo admin password on the post-signup page | Low | Requires storing + displaying it safely; user must save it |
| C. Send a welcome email with first-login instructions | Medium | Requires email provider setup (Resend, SendGrid, etc.) |
| D. Show a "Your workspace is ready" page with a one-time access link | Medium | Requires a token-based first-login flow |

**Recommended:** Option A. After `createOdooDatabase` succeeds, call Odoo's XML-RPC `execute_kw` to update the `res.users` admin record: set `login` = user's email, `password` = user's Basetaa password. This way their signup credentials work in Odoo natively.

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
| User can log into Odoo after signup | ❌ Credentials not provided to user |
| Admin can see Odoo DB assignment | ❌ Not shown in admin panel |

**Verdict: Not ready for real users until credential gap is resolved. Ready for internal engineering testing** (team members can retrieve credentials from the DB directly).

---

## Recommended Next Stage

### Stage: Odoo Credential Handoff

Before any external or internal user testing, resolve the credential gap:

1. **Implement Odoo XML-RPC user update** in `odoo-db.ts`:
   - After `createOdooDatabase` returns success, call Odoo XML-RPC
   - Authenticate as `admin` using `odooAdminPassword`
   - Update `res.users` record: set `login = userEmail`, `password = userBasetaaPassword`
   - Now user can log into Odoo with the same email + password they used to sign up

2. **Show admin panel Odoo details**:
   - Tenant detail page: show `odooDb` value
   - Add a "Reset Odoo Password" admin action for support use

3. **Add post-signup success page**:
   - After provisioning completes, show: "Your workspace is ready at `acme.erp.basetaa.com`"
   - Confirm their login email and prompt them to their Odoo instance

4. **Internal smoke test**:
   - One team member signs up end-to-end
   - Logs into Odoo with their credentials
   - Confirms they see their company's Odoo workspace

### Then: Async Provisioning (after credential handoff)

The current 12-second synchronous signup is acceptable for now but will degrade under load or for slower DB creation (Odoo can take 60+ seconds). The next improvement is:
- Create tenant record immediately (return `workspaceUrl` to user)
- Spin off DB creation as a background job (queue, worker, or simple async)
- Show a "provisioning in progress" page at the subdomain until ready
- The workspace page + pending state already exists for this case
