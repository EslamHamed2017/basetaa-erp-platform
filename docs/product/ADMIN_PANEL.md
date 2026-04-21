# Admin Panel Guide

**URL:** `https://control.erp.basetaa.com`  
**Auth:** NextAuth credential login (email + password, set via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars)

---

## Login

Visit `https://control.erp.basetaa.com/login`. Enter the admin credentials. Session is managed by NextAuth with a server-side cookie.

The NextAuth session has no configurable expiry in the current setup — it expires when the browser session ends.

---

## Tenants List (`/tenants`)

Shows all tenants in reverse chronological order.

**Summary bar:** Total / Trial / Active / Failed counts.

**Table columns:**
- Company / Owner (company name + email)
- Workspace (subdomain link — clickable, opens tenant's Odoo workspace in new tab)
- Plan
- Status badge: `pending` / `trial` / `active` / `inactive`
- Provisioning badge: `pending` / `provisioning` / `ready` / `failed`
- Trial ends (date)
- Joined (date)
- Manage → link to detail page

---

## Tenant Detail (`/tenants/{id}`)

### Header
- Company name + email
- Status badge + Provisioning badge

### Tenant Details Grid
| Field | Description |
|---|---|
| ID | Prisma CUID — unique tenant identifier |
| Owner | Full name from signup |
| Email | Signup email (also Odoo login) |
| Phone | Optional, from signup |
| Company | Company name |
| Subdomain | `{sub}.erp.basetaa.com` link |
| Database | `dbName` field (always `tenant_{sub}`) |
| Odoo DB | `odooDb` field — confirms Odoo DB assignment |
| Odoo Modules | Modules installed (currently `base`) |
| Plan | Plan name |
| Price | `finalPriceAed` / mo |
| Pricing note | Discount label |
| Trial start / end | Trial window dates |
| Created / Updated | Timestamps |

### Odoo Workspace Card
Visible only when `odooDb` is set (i.e., successfully provisioned).

| Field | Value |
|---|---|
| Workspace URL | `https://{sub}.erp.basetaa.com/web` — clickable |
| Odoo Database | `tenant_{sub}` |
| Login | User's signup email |
| Password | "Signup password (hashed — not retrievable)" |

Use this card to verify provisioning succeeded and to give the user their login URL if they are having trouble.

### Provisioning Error Block
Shown (red callout) when `provisioningError` is non-null. Displays the raw error message. Use this to diagnose failed provisioning.

### Feature Flags
Shown if any flags are set for this tenant. Currently informational only.

### Actions
| Button | Condition | Effect |
|---|---|---|
| **Activate** | `provisioningState=ready` AND `status ≠ active` | Sets `status=active`, `isActive=true`. For moving a trial tenant to paid active. |
| **Deactivate** | `status=active` OR `status=trial` | Sets `status=inactive`, `isActive=false`. Nginx gate immediately blocks workspace access. DB preserved. |
| **Retry Provisioning** | `provisioningState=failed` | Re-runs provisioning. Use when DB creation failed. |

---

## Common Admin Scenarios

### User says "I can't access my workspace"
1. Find tenant in list → check Status and Provisioning badges
2. If `provisioningState=failed` → see Provisioning Error → use **Retry Provisioning**
3. If `status=inactive` → use **Activate** if intentional
4. If `status=trial, provisioningState=ready` → workspace should work — tell user to hard refresh

### User says "I can't log into Odoo"
1. Find tenant → check Odoo Workspace card
2. Login field shows their email — confirm they're using the right email
3. Password is their signup password — if forgotten, no admin reset is available from this panel
4. For manual password reset: SSH to server → use XML-RPC to update `res.users` on `tenant_{sub}` DB

### Provisioning failed — what to check
1. See error in Provisioning Error block
2. Common causes: Odoo was down during signup, master password mismatch, DB already existed with conflict
3. Use **Retry Provisioning** — it checks if DB already exists and skips creation if so
4. Check `pm2 logs basetaa-erp --lines 50` on server for full stack trace

### Need to suspend a tenant immediately
1. Click **Deactivate** on the tenant detail page
2. Takes effect on the next request — Nginx gate reads DB in real time, no cache
3. The tenant's Odoo DB remains intact — can reactivate at any time
