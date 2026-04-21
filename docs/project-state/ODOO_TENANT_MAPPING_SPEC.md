# Odoo Tenant Mapping — Technical Specification

> Reference document for all routing, naming, and integration decisions.  
> Covers: database naming, Nginx routing, Odoo configuration, API contracts.

---

## 1. Database Naming Convention

### Rule
```
Odoo database name = tenant_<normalizedSubdomain>
```

### Function (already exists in `src/lib/subdomain.ts`)
```typescript
export function buildDbName(normalizedSubdomain: string): string {
  return `tenant_${normalizedSubdomain.replace(/-/g, '_')}`
}
```

### Examples

| Signup input | normalizedSubdomain | Odoo database name |
|---|---|---|
| `Acme Corp` | `acme-corp` | `tenant_acme_corp` |
| `GlobalEx` | `globalex` | `tenant_globalex` |
| `My Company 1` | `my-company-1` | `tenant_my_company_1` |
| `TechStart` | `techstart` | `tenant_techstart` |

### Constraints
- Lowercase only (Odoo database names are case-sensitive, use lowercase)
- Hyphens in subdomain → underscores in DB name (Postgres allows hyphens but Odoo recommends underscores)
- Prefix `tenant_` guarantees no collision with system databases (`postgres`, `odoo`, `basetaa_control`)
- Maximum length: `tenant_` (7) + normalized subdomain max (32) = 39 chars — within Postgres 63-char limit

### Reserved database names (never provision these)
```
postgres
odoo
basetaa_control
template0
template1
```

---

## 2. Subdomain → Odoo Database Mapping

### Mapping table (stored in Basetaa control DB)

```
tenants.normalizedSubdomain  →  tenants.odooDb
"acme"                       →  "tenant_acme"
"globalex"                   →  "tenant_globalex"
```

Both values are set at provision time and never change for the lifetime of the tenant.

### Lookup path for runtime requests

```
HTTP request: acme.erp.basetaa.com
     ↓
Nginx extracts subdomain from hostname: "acme"
     ↓
Nginx auth_request: GET http://localhost:3000/api/tenant-gate?sub=acme
     ↓
Next.js queries: SELECT * FROM tenants WHERE normalized_subdomain = 'acme'
     ↓
Returns status code based on tenant state
     ↓
Nginx routes to Odoo (200) or Next.js status page (other)
     ↓
Odoo receives request with Host: acme.erp.basetaa.com
     ↓
Odoo dbfilter extracts %d = "acme" → matches database "tenant_acme"
```

---

## 3. Nginx Configuration Spec

### Current Nginx setup (already deployed)
File: `/etc/nginx/sites-available/basetaa-erp`

Handles `erp.basetaa.com` and `*.erp.basetaa.com` on port 443, proxies all to Next.js :3000.

### Required change

Split the wildcard block into two:

**Block 1** — `erp.basetaa.com` + `control.erp.basetaa.com` → Next.js (keep as-is)

**Block 2** — `*.erp.basetaa.com` (workspace tenants) → Odoo via auth_request gateway

### New workspace server block

```nginx
# ── Workspace tenants: *.erp.basetaa.com → Odoo via auth_request gate ─────────
server {
    listen 443 ssl;
    # Match any subdomain that is NOT erp or control
    # Those are handled by the other server block above.
    server_name ~^(?<tenant_sub>[^.]+)\.erp\.basetaa\.com$;

    ssl_certificate     /etc/letsencrypt/live/erp.basetaa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.basetaa.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    access_log /var/log/nginx/basetaa-workspace.access.log;
    error_log  /var/log/nginx/basetaa-workspace.error.log;

    client_max_body_size 50m;

    # ── Auth-request gate: check tenant status before routing ─────────────────
    location / {
        auth_request /internal/tenant-gate;

        # On auth pass (200): proxy to Odoo
        proxy_pass          http://127.0.0.1:8069;
        proxy_http_version  1.1;
        proxy_set_header    Host              $host;
        proxy_set_header    X-Real-IP         $remote_addr;
        proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
        proxy_read_timeout  120s;

        # Odoo websocket / longpolling
        proxy_set_header    Upgrade           $http_upgrade;
        proxy_set_header    Connection        "upgrade";
    }

    # ── Internal auth_request subrequest ──────────────────────────────────────
    location = /internal/tenant-gate {
        internal;
        proxy_pass              http://127.0.0.1:3000/api/tenant-gate?sub=$tenant_sub;
        proxy_pass_request_body off;
        proxy_set_header        Content-Length    "";
        proxy_set_header        X-Original-URI    $request_uri;
        proxy_set_header        X-Nginx-Internal  "1";
        proxy_connect_timeout   3s;
        proxy_read_timeout      5s;
    }

    # ── Fallback: auth_request returned non-200 → serve Next.js status page ───
    # 401/403 = inactive tenant
    # 404     = tenant not found
    # 202     = provisioning in progress (mapped to 402 for Nginx compatibility)
    error_page 401 403 404 500 502 503 504 = @nextjs_fallback;

    location @nextjs_fallback {
        proxy_pass          http://127.0.0.1:3000;
        proxy_http_version  1.1;
        proxy_set_header    Host              $host;
        proxy_set_header    X-Real-IP         $remote_addr;
        proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto $scheme;
    }
}

# ── HTTP → HTTPS for workspace tenants ────────────────────────────────────────
# Already covered by the existing HTTP redirect block (*.erp.basetaa.com)
```

### Important: server_name precedence

Nginx evaluates `server_name` in this order:
1. Exact match (`erp.basetaa.com`)
2. Leading wildcard (`*.erp.basetaa.com`)
3. Regex (`~^...`)

The existing block uses `server_name erp.basetaa.com *.erp.basetaa.com;`
The new workspace block uses a regex.

To avoid conflicts, update the existing block to explicit subdomains:
```nginx
# Change from:
server_name erp.basetaa.com *.erp.basetaa.com;

# To (explicit — takes priority over regex):
server_name erp.basetaa.com control.erp.basetaa.com;
```

Then the regex workspace block catches all other subdomains.

### Verify auth_request module is available
```bash
nginx -V 2>&1 | grep -o auth_request
# Should output: auth_request
```

---

## 4. Odoo Configuration

### File location on server
```
/opt/basetaa-odoo-deploy/odoo.conf
# OR inside the Docker container — check docker-compose.yml for volume mount
```

### Required additions to `odoo.conf`

```ini
[options]
# ... existing config ...

# Tenant database filter
# %d = first subdomain component of the hostname
# acme.erp.basetaa.com → %d = "acme" → matches database "tenant_acme"
dbfilter = ^tenant_%d$

# Disable database manager UI (security: only allow DB ops via master password API)
list_db = False

# Master password — must already be set; confirm value before using in provisioning
# admin_passwd = <current value>
```

### Why `list_db = False`

With `list_db = False`:
- The Odoo database manager web UI is disabled
- `/web/database/manager` returns 403
- Database creation/drop still works via API calls that include `master_pwd`
- Prevents tenants from seeing each other's database names

### Odoo dbfilter regex notes

The `^tenant_%d$` pattern:
- `^` and `$` anchors ensure exact match
- `%d` is replaced by Odoo with the regex-escaped first subdomain component
- For `acme.erp.basetaa.com`: `%d` = `acme` → filter becomes `^tenant_acme$`
- For `my-company.erp.basetaa.com`: `%d` = `my-company`, DB name is `tenant_my_company`
  - Mismatch! Hyphen in subdomain but underscore in DB name.
  - Fix: use `%d` replacement carefully OR normalize: `dbfilter = ^tenant_%d$`
    with subdomain `my_company` (hyphens normalized to underscores at signup)
  - The `buildDbName()` function already converts hyphens to underscores — so the
    subdomain `my-company` maps to DB `tenant_my_company`.
  - But Odoo's `%d` for hostname `my-company.erp.basetaa.com` gives `my-company` (with hyphen).
  - The filter `^tenant_%d$` becomes `^tenant_my-company$` which does NOT match `tenant_my_company`.

**Resolution**: Use a broader dbfilter and let Odoo pick the closest match, OR use Nginx to pass
the correct DB name as a header, OR restrict subdomains to no-hyphen at signup.

**Recommended approach**: Add a signup validation rule — no hyphens in subdomains.
Update `validateSubdomain()` to reject hyphens, or replace them with nothing at normalization.

```typescript
// src/lib/subdomain.ts — add hyphen rejection
if (normalized.includes('-')) {
  return { valid: false, normalized, error: 'Subdomain cannot contain hyphens. Use letters and numbers only.' }
}
```

This ensures `normalizedSubdomain` and `buildDbName(sub)` always have underscores only,
and `%d` in Odoo matches the database name exactly.

Alternatively, pass the DB name directly via an Nginx header:

```nginx
# In the workspace location block, after auth_request passes:
auth_request_set    $odoo_db $upstream_http_x_odoo_db;
proxy_set_header    X-Odoo-Dbname $odoo_db;
```

And return `X-Odoo-Db: tenant_acme` from the `tenant-gate` endpoint.
Then use a broader dbfilter and let the header control database selection.
**But**: Odoo does not natively support selecting a database via HTTP header — it uses the
hostname with `dbfilter` or the `db` URL parameter.

**Simplest final decision**: Restrict subdomains to alphanumeric only at signup. No hyphens.
This is the zero-ambiguity path.

---

## 5. Tenant Gate API Specification

### Endpoint
```
GET /api/tenant-gate?sub={normalizedSubdomain}
```

### Authentication
Request must include header `X-Nginx-Internal: 1` (set by Nginx on internal subrequests).
If this header is absent, return `403` to prevent direct browser access.

### Response codes

| HTTP Status | Meaning | Nginx action |
|---|---|---|
| `200` | Tenant active and ready | Proxy to Odoo :8069 |
| `202` | Tenant provisioning / pending | Serve Next.js pending page |
| `403` | Tenant inactive or deactivated | Serve Next.js inactive page |
| `404` | Tenant not found | Serve Next.js not-found page |
| `500` | Internal error (DB unreachable) | Serve Next.js error page |

### Response headers (on 200 only)
```
X-Odoo-Db: tenant_acme
```

### Implementation

```typescript
// src/app/api/tenant-gate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  // Block direct browser access
  if (req.headers.get('x-nginx-internal') !== '1') {
    return new NextResponse(null, { status: 403 })
  }

  const sub = req.nextUrl.searchParams.get('sub')
  if (!sub) return new NextResponse(null, { status: 404 })

  const tenant = await prisma.tenant.findUnique({
    where: { normalizedSubdomain: sub },
    select: { status: true, provisioningState: true, odooDb: true },
  })

  if (!tenant) return new NextResponse(null, { status: 404 })

  if (tenant.status === 'inactive') {
    return new NextResponse(null, { status: 403 })
  }

  if (
    tenant.status === 'pending' ||
    tenant.provisioningState === 'pending' ||
    tenant.provisioningState === 'provisioning' ||
    tenant.provisioningState === 'failed'
  ) {
    return new NextResponse(null, { status: 202 })
  }

  // provisioningState === 'ready' AND status is trial or active
  return new NextResponse(null, {
    status: 200,
    headers: { 'X-Odoo-Db': tenant.odooDb ?? `tenant_${sub}` },
  })
}
```

---

## 6. Odoo Database Provisioning API

### Odoo endpoint: Create database
```
POST http://localhost:8069/web/database/create
Content-Type: application/x-www-form-urlencoded

master_pwd=<master_password>
&name=tenant_acme
&login=admin
&password=<generated_admin_password>
&lang=en_US
&country_code=
```

### Odoo endpoint: List databases
```
POST http://localhost:8069/web/database/list
Content-Type: application/json

{}

Response: ["odoo", "tenant_acme", "tenant_globex"]
```

### Odoo endpoint: Drop database
```
POST http://localhost:8069/web/database/drop
Content-Type: application/x-www-form-urlencoded

master_pwd=<master_password>
&name=tenant_acme
```

### Implementation contract: `src/lib/odoo-db.ts`

```typescript
// All functions are server-side only — never imported in client components

export async function createOdooDatabase(
  dbName: string,
  adminPassword: string
): Promise<{ success: boolean; error?: string }>

export async function odooDatabaseExists(
  dbName: string
): Promise<boolean>

export async function dropOdooDatabase(
  dbName: string
): Promise<{ success: boolean; error?: string }>

// Internal helper — not exported
function getOdooUrl(): string  // reads ODOO_URL env var
function getMasterPassword(): string  // reads ODOO_MASTER_PASSWORD env var
```

### Error handling

| Odoo response | Meaning | Action |
|---|---|---|
| HTTP 200 | Database created | Mark tenant ready |
| HTTP 302 redirect to `/web` | Database created (Odoo 17 behavior) | Treat as success |
| HTTP 500 + "already exists" | DB exists already | Check with `odooDatabaseExists` first |
| HTTP 403 | Wrong master password | Throw — configuration error |
| Connection refused / timeout | Odoo down | Throw — provisioning fails, admin can retry |

---

## 7. Prisma Schema Changes

### Fields to add to `Tenant` model

```prisma
model Tenant {
  // ... all existing fields unchanged ...

  // Odoo integration (added in Reality Plan)
  odooDb            String?    // e.g. "tenant_acme" — same value as dbName going forward
  odooAdminPassword String?    // generated at provision time, stored for service operations
  odooModules       String[]   @default([])  // e.g. ["base", "mail", "sale"]

  // @@map stays the same
}
```

### Migration
```bash
npx prisma migrate dev --name add_odoo_fields
```

Generates a non-destructive `ALTER TABLE` — adds nullable columns. Safe to run on existing data.

### Backward compatibility
- All existing Tenant records will have `odooDb = null`, `odooAdminPassword = null`
- These tenants will return `202` from the tenant-gate (provisioning state is not `ready`)
- Admin can reprovision them individually through the control panel

---

## 8. Subdomain Restriction Update

To avoid the hyphen/underscore mismatch between Nginx `%d` and DB names:

### Change in `src/lib/subdomain.ts`

```typescript
export function validateSubdomain(raw: string): SubdomainValidation {
  const normalized = normalizeSubdomain(raw)  // still normalizes as before

  // ... existing length/reserved checks ...

  // NEW: reject hyphens to ensure %d matches DB name exactly
  if (normalized.includes('-')) {
    return {
      valid: false,
      normalized,
      error: 'Subdomain may only contain letters and numbers (no hyphens).',
    }
  }

  return { valid: true, normalized }
}
```

This means:
- `my-company` → rejected at signup
- `mycompany` → accepted → DB name `tenant_mycompany` → Odoo `%d` = `mycompany` → exact match ✓

---

## 9. Environment Variables

### New variables required

```bash
# .env.local additions

# Odoo server URL (server-side only)
ODOO_URL="http://localhost:8069"

# Odoo master password (must match admin_passwd in odoo.conf)
ODOO_MASTER_PASSWORD="<value from odoo.conf admin_passwd>"
```

### Security notes
- `ODOO_MASTER_PASSWORD` is never exposed to the browser
- Never log this value
- Rotate by changing `admin_passwd` in `odoo.conf` AND updating `.env.local`
- The generated `odooAdminPassword` per tenant is also sensitive — treat as a secret

---

## 10. Summary Decision Table

| Decision | Choice | Reason |
|---|---|---|
| DB naming | `tenant_{subdomain}` | Already implemented in `buildDbName()` |
| Hyphen handling | Reject hyphens at signup | Eliminates `%d` mismatch with DB names |
| Routing gateway | Nginx `auth_request` | Clean separation, no Next.js proxy needed |
| Active tenant routing | Nginx → Odoo :8069 directly | No Next.js overhead for active workspaces |
| Inactive/pending routing | Nginx fallback → Next.js | Existing status pages reused |
| Odoo DB selection | `dbfilter = ^tenant_%d$` | Native Odoo mechanism, no custom code |
| DB manager UI | `list_db = False` | Security — hide tenant DB names |
| Auth for workspace | Odoo's own login | No custom auth needed in Reality Plan |
| Admin password storage | `odooAdminPassword` in Prisma | Needed for future service operations |
| DB creation API | Odoo HTTP form POST | Official Odoo mechanism, no raw SQL |
