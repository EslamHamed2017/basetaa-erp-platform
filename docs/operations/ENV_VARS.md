# Environment Variables Reference

All environment variables are set in `/opt/basetaa-erp-platform/.env.local` on the server.  
This file is **not in git** and must never be committed.

For local development, copy `.env.example` to `.env.local` and fill in values.

---

## Required Variables

### Database

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the control DB | `postgresql://odoo:password@localhost:5432/basetaa_control` |

The control DB is on the same Docker Postgres instance as tenant DBs.  
Docker Compose exposes Postgres on `localhost:5432`.

---

### Domain

| Variable | Purpose | Example |
|---|---|---|
| `BASE_DOMAIN` | Base domain for subdomain extraction in middleware | `erp.basetaa.com` |

Used by `src/middleware.ts` to extract the tenant subdomain from the hostname.  
For local dev: set to `localhost`.

---

### Admin Credentials

| Variable | Purpose | Notes |
|---|---|---|
| `ADMIN_EMAIL` | Login email for the admin panel | Set once at setup |
| `ADMIN_PASSWORD` | Login password for the admin panel | Min 8 chars recommended |

These are verified directly in `src/lib/auth-options.ts` against the env vars (no DB lookup for admin).

---

### NextAuth

| Variable | Purpose | Notes |
|---|---|---|
| `NEXTAUTH_SECRET` | Signs and encrypts NextAuth session JWTs | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL of the app — used by NextAuth internally | Production: `https://erp.basetaa.com` |

---

### Odoo Integration

| Variable | Purpose | Notes |
|---|---|---|
| `ODOO_URL` | Internal URL to reach Odoo | `http://localhost:8069` on production server |
| `ODOO_MASTER_PASSWORD` | Odoo master password (`admin_passwd` in odoo.conf) | Used for DB create/list/drop API calls |

These are server-side only. Never exposed to the browser.

---

### Trial Config

| Variable | Purpose | Default |
|---|---|---|
| `TRIAL_DAYS` | Number of trial days given to new signups | `14` |

---

## Variable Checklist for New Server Setup

```
[ ] DATABASE_URL          — PostgreSQL URL for basetaa_control DB
[ ] BASE_DOMAIN           — erp.basetaa.com
[ ] ADMIN_EMAIL           — admin panel login email
[ ] ADMIN_PASSWORD        — admin panel login password
[ ] NEXTAUTH_SECRET       — random 32-byte base64 string
[ ] NEXTAUTH_URL          — https://erp.basetaa.com
[ ] ODOO_URL              — http://localhost:8069
[ ] ODOO_MASTER_PASSWORD  — matches admin_passwd in odoo.conf
[ ] TRIAL_DAYS            — 14 (or as required)
```

---

## Local Development `.env.local` Template

See `.env.example` in the repository root for the template with placeholder values.

For local dev, Odoo is typically not running — provisioning will fail unless you have a local Odoo instance or mock the calls.
