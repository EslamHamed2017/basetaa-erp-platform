# Security Notes

---

## Authentication Model

### Admin Panel
- NextAuth credential provider (email + password)
- Credentials verified against `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars
- Sessions managed server-side via NextAuth with `NEXTAUTH_SECRET`-signed JWT
- All admin routes (`/admin/*`, `/api/admin/*`) require valid session

### Tenant Workspaces
- Authentication is handled entirely by Odoo's own login system
- User signs up on Basetaa → credentials set on their Odoo admin account via XML-RPC
- Basetaa does not proxy or intercept Odoo sessions
- No SSO between Basetaa and Odoo

### Tenant Gate (`/api/tenant-gate`)
- Protected by `X-Nginx-Internal: 1` header check
- If called without this header → 403 immediately
- Called only by Nginx as an internal subrequest (never by browsers directly)

---

## Access Control

### What's publicly accessible
- `erp.basetaa.com` — landing page and signup (intentionally public)
- `{sub}.erp.basetaa.com` — only if tenant is `trial` or `active` AND `provisioningState=ready`

### What requires admin auth
- `control.erp.basetaa.com` (redirects to login)
- All `/api/admin/*` routes

### What's blocked entirely
- `{sub}.erp.basetaa.com/web/database/*` — Nginx `deny all` prevents external DB management
- Odoo ports (8069) are not blocked by OS firewall but are not externally routed (Nginx handles all external traffic)

---

## Data Stored and Where

| Data | Storage | Protection |
|---|---|---|
| Signup passwords | `basetaa_control.tenants.passwordHash` | bcrypt, 12 rounds — one-way |
| Odoo admin passwords (generated) | `basetaa_control.tenants.odooAdminPassword` | Plaintext in DB (filesystem-level protection) |
| User's Odoo credentials | Set in Odoo's `res.users` | Odoo auto-hashes via its own mechanism |
| Admin panel credentials | `.env.local` on server | Not in git, file-level protection |
| Odoo master password | `.env.local` + `odoo.conf` on server | Not in git |

---

## Known Risks and Limitations

### Medium Risk

| Risk | Detail | Mitigation |
|---|---|---|
| No rate limiting on `/api/signup` | Anyone can spam the signup endpoint and create Odoo DBs | Add rate limiting (Nginx `limit_req` or app-level) before public launch |
| Admin credentials in env vars | No password hashing — if `.env.local` is read, admin access is immediate | Use strong password; restrict SSH access |
| `odooAdminPassword` stored plaintext in control DB | Not hashed — accessible via direct Postgres query | Low practical risk (DB is internal only); consider encrypting at rest if compliance required |
| Single PM2 process (fork mode) | One crash = brief downtime | Use cluster mode with ≥2 instances for production |
| No CSRF protection on admin actions | Admin action routes use `fetch()` POST — no CSRF token | Add NextAuth CSRF token validation before public launch |

### Low Risk

| Risk | Detail |
|---|---|
| `list_db = True` on Odoo | Required for DB creation API; Nginx blocks `/web/database/*` externally — acceptable tradeoff |
| Admin session has no timeout | Sessions last until browser close; consider adding `maxAge` to NextAuth config |
| Odoo `workers = 0` | Single-process Odoo; high concurrency could cause slowdowns |

### Accepted for MVP (revisit before external launch)

- No email verification on signup
- No payment gating
- No audit log for admin actions
- No per-tenant resource limits (storage, users, modules)

---

## Pre-External-Launch Security Checklist

```
[ ] Rate limit /api/signup (Nginx limit_req or middleware)
[ ] Add CSRF protection to admin action endpoints
[ ] Enable NextAuth session maxAge (e.g. 8h)
[ ] Enable HTTPS-only cookies (SameSite=Strict)
[ ] Set up fail2ban or similar for SSH brute force
[ ] Review Odoo admin_passwd strength (min 20 chars)
[ ] Enable Postgres connection SSL
[ ] Add /api/signup honeypot or captcha
[ ] Audit PM2 logs for any plaintext secret leakage
[ ] Confirm no secrets in git history: git log --all -S 'password'
```
