# Basetaa ERP Platform

Multi-tenant SaaS ERP platform that provisions dedicated Odoo 17 workspaces for each customer. Each customer signs up, gets their own Odoo database at a personal subdomain, and logs in with their signup credentials.

**Status:** Operational — ready for internal real-user testing (2026-04-21)

---

## Live Environment

| | URL |
|---|---|
| Public site | https://erp.basetaa.com |
| Admin panel | https://control.erp.basetaa.com |
| Tenant workspace | https://{subdomain}.erp.basetaa.com |

---

## Documentation

Full documentation is in [`docs/`](docs/README.md).

| Section | Contents |
|---|---|
| [Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md) | Stack, component map, routing, data flows |
| [Domain Reference](docs/architecture/DOMAIN_REFERENCE.md) | All URLs, DNS, Nginx blocks |
| [Executive Snapshot](docs/project-state/EXECUTIVE_SNAPSHOT.md) | Current status, what works, what's next |
| [Feature Overview](docs/product/FEATURES.md) | Full capability inventory |
| [Provisioning Flow](docs/product/SIGNUP_PROVISIONING_FLOW.md) | Signup → Odoo DB → credential handoff, step by step |
| [Admin Panel Guide](docs/product/ADMIN_PANEL.md) | Admin capabilities and common scenarios |
| [Deployment Guide](docs/operations/DEPLOYMENT.md) | How to deploy to production |
| [Server Config](docs/operations/SERVER_CONFIG.md) | Nginx, Odoo, Docker, PM2, SSL reference |
| [Environment Variables](docs/operations/ENV_VARS.md) | All env vars and setup checklist |
| [PM2 Operations](docs/runbooks/PM2_OPERATIONS.md) | Restart, reload, crash recovery |
| [Provisioning Failure](docs/runbooks/PROVISIONING_FAILURE.md) | Diagnose and recover failed provisioning |
| [Nginx Operations](docs/runbooks/NGINX_OPERATIONS.md) | Config, reload, 502/403 diagnosis |
| [Internal Testing Guide](docs/testing/INTERNAL_TESTING.md) | First real-user signup checklist |
| [Troubleshooting](docs/testing/TROUBLESHOOTING.md) | Symptom → cause → fix |
| [Secrets Index](docs/security/SECRETS_INDEX.md) | What secrets exist and where (no values) |
| [Security Notes](docs/security/SECURITY_NOTES.md) | Auth model, known risks, pre-launch checklist |

---

## Tech Stack

- **Next.js 14** (App Router) — public site, admin panel, provisioning API
- **Prisma + PostgreSQL** — control database (tenants, plans)
- **Odoo 17 Community** — ERP backend, one database per tenant
- **Nginx** — SSL termination, subdomain routing, auth_request gate
- **PM2** — Node.js process management
- **Docker** — Odoo + PostgreSQL containerization
- **Let's Encrypt** — wildcard SSL for `*.erp.basetaa.com`

---

## Development Setup

```bash
# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Fill in values — see docs/operations/ENV_VARS.md

# Apply DB schema
npx prisma db push

# Run dev server
npm run dev
```

See [docs/operations/ENV_VARS.md](docs/operations/ENV_VARS.md) for all required variables.

---

## Important Security Note

- Never commit `.env.local` or any file containing real credentials
- See [docs/security/SECRETS_INDEX.md](docs/security/SECRETS_INDEX.md) for the complete secrets inventory
- Production secrets live in `/opt/basetaa-erp-platform/.env.local` on the server (SSH access required)
