# Executive Snapshot — Basetaa ERP Platform

> Date: 2026-04-21  
> Prepared by: Basetaa Engineering

---

## What Is This

Basetaa ERP is a multi-tenant SaaS platform that provisions dedicated Odoo 17 workspaces for each customer. Each customer signs up, gets their own Odoo database at a personal subdomain, and logs in with their signup credentials.

Basetaa owns the public site, signup flow, tenant provisioning, subdomain routing, and admin control panel. The ERP workspace itself is native Odoo.

---

## Current Status: Operational

The platform is live on `187.127.112.42` and ready for **internal real-user testing**.

| Component | Status |
|---|---|
| Public site (`erp.basetaa.com`) | ✅ Live |
| Signup form | ✅ Functional |
| Tenant provisioning | ✅ Functional (~15s synchronous) |
| Odoo DB creation | ✅ Working |
| Credential handoff | ✅ Users log into Odoo with signup credentials |
| Subdomain routing | ✅ `acme.erp.basetaa.com` → correct Odoo DB |
| Nginx auth gate | ✅ Blocks inactive/unknown tenants |
| SSL | ✅ Wildcard `*.erp.basetaa.com` + apex |
| Admin panel | ✅ Full tenant management + Odoo visibility |

---

## What Works End-to-End

1. User visits `erp.basetaa.com` and fills in signup form
2. System creates a Tenant record in the control DB
3. System calls Odoo HTTP API to create `tenant_{subdomain}` database (~12s)
4. System calls Odoo XML-RPC to set the user's email + password on the Odoo admin user
5. Tenant marked `trial/ready` in control DB
6. User's subdomain `acme.erp.basetaa.com` immediately resolves to their Odoo instance
7. User logs into Odoo with their signup credentials
8. Admin can view, activate, deactivate, and reprovision tenants from the control panel

---

## Live Test Tenants (as of 2026-04-21)

| Subdomain | Status | Odoo DB | Notes |
|---|---|---|---|
| `testco` | trial/ready | `tenant_testco` | First Reality Plan live test |
| `credtest0592` | trial/ready | `tenant_credtest0592` | Credential handoff verification |
| `regtest0779` | trial/ready | `tenant_regtest0779` | Signup regression test |
| `test1` | trial/ready | `tenant_test1` | Pre-Reality Plan, `odooDb` NULL (fallback works) |
| `geo` | active/ready | `tenant_geo` | Pre-Reality Plan, `odooDb` NULL (fallback works) |

---

## What Is NOT Yet Built

| Feature | Priority | Notes |
|---|---|---|
| Async provisioning | Medium | Currently synchronous ~15s; will degrade under load |
| Post-signup email confirmation | Medium | No email provider wired |
| Billing / payment integration | Future | Plans exist in DB, no payment flow |
| Odoo module customization per tenant | Future | Currently only `base` installed |
| Tenant delete (drop Odoo DB) | Low | `dropOdooDatabase()` exists in code, not wired to admin UI |
| Admin panel reprovision updates `odooDb` | Low | Currently skipped on reprovision |

---

## Next Step

Run the first internal real-user signup. See [Internal Testing Guide](../testing/INTERNAL_TESTING.md).

After that: async provisioning to remove the ~15s signup wait.
