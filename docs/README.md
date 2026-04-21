# Basetaa ERP Platform — Documentation

> Last updated: 2026-04-21  
> Status: **Operational — Ready for internal real-user testing**

---

## Quick Reference

| What | Where |
|---|---|
| Live public site | https://erp.basetaa.com |
| Admin panel | https://control.erp.basetaa.com |
| Tenant workspace example | https://testco.erp.basetaa.com |
| Server IP | 187.127.112.42 |
| Repository | basetaa-erp-platform (GitHub) |

---

## Documentation Index

### Architecture
- [System Architecture](architecture/SYSTEM_ARCHITECTURE.md) — components, data flow, stack versions
- [Domain & URL Reference](architecture/DOMAIN_REFERENCE.md) — all URLs, routing rules, DNS setup

### Project State
- [Executive Snapshot](project-state/EXECUTIVE_SNAPSHOT.md) — current status, what works, what's next
- [Reality Plan](project-state/REALITY_PLAN.md) — original plan document
- [Implementation Checklist](project-state/REALITY_IMPLEMENTATION_CHECKLIST.md) — phase-by-phase completion
- [Stabilization Report](project-state/STABILIZATION_REPORT.md) — live test results, known state

### Product
- [Feature Overview](product/FEATURES.md) — full capability inventory of the running system
- [Signup & Provisioning Flow](product/SIGNUP_PROVISIONING_FLOW.md) — step-by-step flow with code references
- [Admin Panel Guide](product/ADMIN_PANEL.md) — what admins can see and do

### Operations
- [Deployment Guide](operations/DEPLOYMENT.md) — how to deploy to the production server
- [Server Configuration](operations/SERVER_CONFIG.md) — Nginx, PM2, SSL, Odoo config reference
- [Environment Variables](operations/ENV_VARS.md) — all variables, their purpose, where to set them

### Runbooks
- [PM2 Restart & Reload](runbooks/PM2_OPERATIONS.md) — safe restart procedures
- [Provisioning Failure Recovery](runbooks/PROVISIONING_FAILURE.md) — how to diagnose and reprovision
- [Nginx Operations](runbooks/NGINX_OPERATIONS.md) — reload, config test, common fixes

### Testing
- [Internal Real-User Test Guide](testing/INTERNAL_TESTING.md) — first real signup checklist
- [Troubleshooting Guide](testing/TROUBLESHOOTING.md) — common failures and how to diagnose them

### Security
- [Secrets Index](security/SECRETS_INDEX.md) — what secrets exist, where stored (no actual values)
- [Security Notes](security/SECURITY_NOTES.md) — auth model, access control, known risks

---

## Current Commit Trail

| Commit | Description |
|---|---|
| `5b5e081` | Reality Plan — full Odoo integration |
| `7ba633b` | Provisioning bug fixes (list_db, phone field, error detection) |
| `ce1fab3` | Stabilization report |
| `b1644f9` | Odoo credential handoff via XML-RPC |
| `38fcd65` | Admin panel Odoo visibility, internal testing readiness |
