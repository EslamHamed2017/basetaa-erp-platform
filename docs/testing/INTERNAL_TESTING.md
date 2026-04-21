# Internal Real-User Test Guide

> Use this guide for the first real end-to-end signup test.  
> Platform status: ready for internal testing as of 2026-04-21.

---

## Pre-Test: Confirm Platform is Up

Before testing, verify:

```bash
# From server (SSH root@187.127.112.42)
pm2 list                                              # basetaa-erp: online
curl http://localhost:8069/web/health                  # {"status":"pass"}
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/site  # 200
```

Or check externally: `https://erp.basetaa.com` should load the landing page.

---

## Test Data

| Field | Suggested value |
|---|---|
| Full name | Your real name |
| Company name | Your company or a test name |
| Email | Your real email address |
| Password | At least 8 chars — you will use this to log into Odoo |
| Subdomain | Short, clean, memorable (e.g. `eslam`, `basetaa`, `demo`) |
| Plan | Growth (default) |

> Check `https://control.erp.basetaa.com/tenants` first to confirm the subdomain is not already taken.

---

## Test Steps

### Step 1 — Sign up

1. Open `https://erp.basetaa.com` in a browser (private window recommended)
2. Click **Get Started** or navigate to `/signup`
3. Fill in the form with your test data
4. Submit — **wait 10–20 seconds** (provisioning is synchronous)
5. The page should return a success response. Note what it shows.

---

### Step 2 — Access workspace

6. Open `https://{your-subdomain}.erp.basetaa.com` in the browser
7. Expected: Odoo login page loads (not a 403 page, not a blank page)

---

### Step 3 — Log in to Odoo

8. Enter your signup **email** as username
9. Enter your signup **password**
10. Click Log In
11. Expected: Odoo home screen / app menu loads

---

### Step 4 — Verify admin panel

12. Open `https://control.erp.basetaa.com` (log in if prompted)
13. Find your tenant in the list
14. Click **Manage**
15. Verify:
    - Status: `trial`
    - Provisioning: `ready`
    - Odoo DB: `tenant_{your-subdomain}`
    - Odoo Workspace card shows your email as login

---

## Success Criteria

| Check | Pass |
|---|---|
| Signup form submitted without error | ✅ |
| Response time < 30 seconds | ✅ |
| `{sub}.erp.basetaa.com` loads Odoo login page | ✅ |
| Login with signup email + password succeeds | ✅ |
| Odoo home screen visible | ✅ |
| Admin panel shows `trial / ready` | ✅ |
| Admin Odoo Workspace card shows correct DB + email | ✅ |

---

## If Something Fails

### Signup error (form)
- Check the error message — field validation errors will show inline
- If generic server error: check `pm2 logs basetaa-erp --lines 50`

### Long wait / timeout
- Odoo DB creation takes ~12s. If > 30s, Odoo may be overloaded or restarting
- Check: `curl http://localhost:8069/web/health`

### Workspace shows 403 or status page
- Check tenant record in admin panel — if `provisioningState=failed`, see error message
- Use **Retry Provisioning** button

### Odoo login fails with correct credentials
- Credential handoff may have failed mid-provisioning
- Check `pm2 logs basetaa-erp` for "credential handoff failed" message
- See [Provisioning Failure Runbook](../runbooks/PROVISIONING_FAILURE.md)

### Browser shows cached 502
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

---

## What to Record

After completing the test, note:

```
Date/time:
Subdomain used:
Signup response time (seconds):
Odoo login: Pass / Fail
Admin panel Odoo card: Correct / Missing
Overall result: Pass / Fail
Notes (any unexpected behaviour):
```

---

## After a Successful Test

1. Share result with the team
2. Keep the test tenant (`trial` status) for ongoing verification
3. Clear to invite the next internal tester
4. Open to wider internal team once 3+ successful tests confirmed
