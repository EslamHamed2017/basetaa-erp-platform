# Secrets Index

> This document lists all secrets used in the Basetaa ERP platform.  
> **No actual secret values are recorded here.**  
> For the actual values, see the server `.env.local` file (SSH access required).

---

## Server Secrets (`.env.local` on production server)

Located at: `/opt/basetaa-erp-platform/.env.local`  
Access: SSH as root to `187.127.112.42`

| Secret Name | Purpose | Who needs it | Rotation notes |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string for `basetaa_control` DB, includes host, port, user, password | App server only | Rotate by updating Postgres password + `.env.local` + `pm2 reload` |
| `ADMIN_EMAIL` | Login email for the admin control panel | Engineering team | Change by updating `.env.local` + `pm2 reload` |
| `ADMIN_PASSWORD` | Login password for the admin control panel | Engineering team | Change by updating `.env.local` + `pm2 reload`. Use strong password (20+ chars). |
| `NEXTAUTH_SECRET` | Signs/encrypts NextAuth session tokens | App server only | Rotating invalidates all active admin sessions. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL used by NextAuth internally | App server only | Not a secret per se, but must match the deployed URL |
| `ODOO_MASTER_PASSWORD` | Odoo master password — used for DB create/list/drop API calls | App server only | Must match `admin_passwd` in `odoo.conf`. Rotating requires updating both files. |
| `ODOO_URL` | Internal Odoo URL (`http://localhost:8069`) | App server only | Not sensitive, but server-side only |

---

## Server-Level Credentials

| Secret | Purpose | Where stored | Who needs it | Notes |
|---|---|---|---|---|
| SSH root password | Root shell access to `187.127.112.42` | Team password manager | Engineering team | Prefer SSH key auth. Rotate via `passwd root` on server. |
| SSH private key | Key-based SSH auth (if configured) | Individual engineer machines only | Engineering team | Never commit to git |
| Postgres password (Docker) | Direct Postgres access (`POSTGRES_PASSWORD` in docker-compose env) | `/opt/basetaa-odoo-deploy/docker-compose.yml` env or `.env` file on server | Engineering team | Used by Odoo containers and DATABASE_URL |

---

## Odoo Configuration Secrets

| Secret | Purpose | Where stored | Notes |
|---|---|---|---|
| `admin_passwd` (odoo.conf) | Odoo master password — same value as `ODOO_MASTER_PASSWORD` env var | `/opt/basetaa-odoo-deploy/config/odoo.conf` | Must stay in sync with `.env.local`. Not in git. |

---

## Per-Tenant Secrets (in control DB)

| Field | Purpose | Where stored | Notes |
|---|---|---|---|
| `tenants.odooAdminPassword` | The randomly generated Odoo DB admin password (set at provisioning time, then overwritten by user's credentials via XML-RPC) | `basetaa_control` PostgreSQL DB, `tenants` table | Not retrievable from admin panel UI. Access via direct DB query. |
| `tenants.passwordHash` | bcrypt hash of user's signup password | `basetaa_control` PostgreSQL DB | One-way hash — not retrievable |

---

## What Is NOT a Secret (safe to have in repo)

- `.env.example` — placeholder values only, no real credentials
- `BASE_DOMAIN=erp.basetaa.com` — public domain name
- `TRIAL_DAYS=14` — not sensitive
- `ODOO_URL=http://localhost:8069` — internal URL, no auth embedded
- All source code

---

## Secret Hygiene Rules

1. **Never commit `.env.local`** — it is in `.gitignore`
2. **Never commit `odoo.conf` containing real `admin_passwd`** — the conf in the repo (`docs/project-state/`) should use placeholder values
3. **Never log secrets** — `ODOO_MASTER_PASSWORD` and `DATABASE_URL` must not appear in PM2 logs
4. **Rotate on team member offboarding** — SSH password, admin panel password, NEXTAUTH_SECRET
5. **`ODOO_MASTER_PASSWORD` and `admin_passwd` must match** — rotating one requires rotating the other simultaneously

---

## Emergency: Suspected Secret Exposure

If any of the above secrets may have been exposed (e.g., committed to git, sent in a message):

1. Immediately rotate the exposed secret on the server
2. If `NEXTAUTH_SECRET` exposed → rotate it (all admin sessions invalidated)
3. If `ODOO_MASTER_PASSWORD` exposed → change `admin_passwd` in `odoo.conf` + `ODOO_MASTER_PASSWORD` in `.env.local` simultaneously + `docker compose restart odoo` + `pm2 reload`
4. If Postgres password exposed → change in Postgres + update `DATABASE_URL` + docker-compose env + `pm2 reload`
5. If SSH root password exposed → `passwd root` on server + update team password manager
6. Review git history for the exposure: `git log -S 'suspicious-string' --all`
