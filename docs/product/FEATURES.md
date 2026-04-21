# Feature & Capability Overview

> Describes what the platform can do as of 2026-04-21.  
> This is the current live system — not a roadmap.

---

## Public Site

- Landing page at `erp.basetaa.com`
- Signup form with: full name, company name, email, phone (optional), subdomain, password, plan selection
- Input validation: email format, subdomain format (3–40 chars, alphanumeric + hyphens), password min 8 chars
- Subdomain uniqueness check before provisioning
- Email uniqueness check before provisioning
- ~15 second synchronous provisioning — user waits on same request for workspace to be ready
- Returns `workspaceUrl` on success

---

## Tenant Provisioning

- Generates a cryptographically random Odoo admin password (`crypto.randomBytes(24).toString('base64url')`)
- Creates Odoo database via HTTP API (`POST /web/database/create`)
  - Includes: `name`, `login=admin`, `password={generated}`, `lang=en_US`, `country_code=AE`, `phone=''`
  - Detects errors: already exists, invalid master password, DB manager disabled, creation errors
  - Treats "already exists" as safe for re-provisioning
- Sets user's signup credentials on the Odoo admin account via XML-RPC
  - Authenticates as `admin` using generated password → gets UID
  - Writes `login`, `email`, `password` on `res.users` record
  - Odoo auto-hashes the password server-side
- Stores on Tenant record: `odooDb`, `odooAdminPassword`, `odooModules: ['base']`
- Marks tenant `status=trial`, `provisioningState=ready`, `isActive=true`
- On any failure: marks `provisioningState=failed`, stores error in `provisioningError`

---

## Tenant Workspace Routing

- Every request to `{sub}.erp.basetaa.com` goes through Nginx `auth_request` gate
- Gate checks tenant status in real time from the control DB
- `trial` or `active` + `provisioningState=ready` → 200 → proxied to Odoo
- Anything else → 403 → Next.js serves status page
- Status pages: pending, inactive, not-found — each with distinct UI
- Active tenant never reaches Next.js — Nginx routes directly to Odoo
- Odoo `dbfilter = ^tenant_%d$` maps hostname to correct tenant database

---

## Odoo Workspace (per tenant)

- Full Odoo 17 Community ERP with `base` module installed
- Accessible at `https://{sub}.erp.basetaa.com`
- User logs in with the same email and password used to sign up
- Odoo manages its own session, auth, and all ERP functionality
- Database manager (`/web/database/*`) blocked externally by Nginx

---

## Admin Panel

Access: `https://control.erp.basetaa.com` (NextAuth credential login required)

### Tenant List View
- Table of all tenants with: company name, email, workspace subdomain (clickable), plan, status badge, provisioning badge, trial end date, signup date
- Summary stats: total, trial, active, failed counts

### Tenant Detail View
- All tenant fields: ID, owner, email, phone, company, subdomain link, database name
- **Odoo DB** name
- **Odoo Modules** installed
- **Odoo Workspace card**: workspace URL (clickable), Odoo DB name, login email, password note
- Plan, pricing, trial window dates
- Provisioning error display (with red callout if present)
- Feature flags list (if any)

### Admin Actions (per tenant)
| Action | Available when | Effect |
|---|---|---|
| Activate | `provisioningState=ready` AND `status ≠ active` | Sets `status=active`, `isActive=true` |
| Deactivate | `status=active` OR `status=trial` | Sets `status=inactive`, `isActive=false`. Workspace access blocked immediately via gate. Odoo DB preserved. |
| Retry Provisioning | `provisioningState=failed` | Re-runs full provisioning flow. Uses stored `odooAdminPassword` if present, generates new one otherwise. |

---

## Security

- Admin panel protected by NextAuth credential auth (email + password, bcrypt)
- Tenant gate endpoint protected by `X-Nginx-Internal: 1` header — returns 403 if called without it
- `/web/database/*` blocked externally by Nginx `deny all`
- Odoo master password stored in server `.env.local` — never in code or git
- Odoo tenant admin passwords stored in control DB — encrypted at rest by filesystem
- Signup passwords: bcrypt hashed (12 rounds) before storage
- Odoo admin passwords: separate random value, stored in `odooAdminPassword` column
- HTTPS enforced via 301 redirect on all HTTP traffic

---

## Plans (in control DB)

Plans exist as records in the `plans` table. The system supports:
- `code` (identifier, e.g. `growth`)
- `name`, `billingCycle`, `listPriceAed`, `discountPercent`, `finalPriceAed`
- `isMostPopular`, `isCustom`, `description`, `features[]`

No payment integration is wired. Plans are purely informational/administrative at this stage.

---

## Feature Flags

The schema supports per-tenant feature flags (`TenantFeatureFlag` model: `flagKey`, `flagValue`). No feature flag logic is implemented in the app yet — the table exists and is displayed in the admin detail view.
