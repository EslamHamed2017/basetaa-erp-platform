# Runbook: Provisioning Failure Recovery

---

## Identify the Failure

### 1. Check admin panel

Visit `https://control.erp.basetaa.com/tenants/{id}`.  
Look for:
- Provisioning badge: `failed` (red)
- Provisioning Error block: contains the raw error message

### 2. Check app logs

```bash
ssh root@187.127.112.42
pm2 logs basetaa-erp --nostream --lines 80
```

Search for the tenant subdomain or error text.

### 3. Check the tenant record directly

```bash
docker exec basetaa-odoo-deploy-db-1 psql -U odoo -d basetaa_control -c \
  "SELECT \"normalizedSubdomain\", status, \"provisioningState\", \"odooDb\", \"provisioningError\"
   FROM tenants WHERE \"normalizedSubdomain\" = 'SUBDOMAIN';"
```

---

## Common Failure Causes and Fixes

### A. "Invalid Odoo master password"

**Cause:** `ODOO_MASTER_PASSWORD` in `.env.local` doesn't match `admin_passwd` in `odoo.conf`.

**Fix:**
```bash
# Check current odoo.conf value
cat /opt/basetaa-odoo-deploy/config/odoo.conf | grep admin_passwd

# Update .env.local to match
nano /opt/basetaa-erp-platform/.env.local
# Restart app
pm2 reload ecosystem.config.js

# Then reprovision from admin panel
```

---

### B. "Odoo database manager is disabled"

**Cause:** `list_db = False` in `odoo.conf`. This blocks the entire `/web/database/*` API.

**Fix:**
```bash
nano /opt/basetaa-odoo-deploy/config/odoo.conf
# Set: list_db = True

cd /opt/basetaa-odoo-deploy
docker compose restart odoo

# Verify
curl -s -o /dev/null -w "%{http_code}" http://localhost:8069/web/database/list
# Should return 200 or 400 (not 403)

# Then reprovision from admin panel
```

---

### C. "Odoo unreachable: …"

**Cause:** Odoo Docker container is down.

**Fix:**
```bash
cd /opt/basetaa-odoo-deploy
docker compose ps           # check status
docker compose logs odoo    # check for startup errors
docker compose up -d        # restart if down

# Verify
curl http://localhost:8069/web/health
# Expected: {"status":"pass"}
```

---

### D. "Odoo credential handoff failed"

**Cause:** DB was created but XML-RPC auth/write failed.

**Impact:** Tenant DB exists and is marked `failed`. User can't log in.

**Diagnosis:**
```bash
# Check if DB actually exists
docker exec basetaa-odoo-deploy-db-1 psql -U odoo -c "\l" | grep SUBDOMAIN
```

**Fix — if DB exists:**
The `Retry Provisioning` button checks if DB exists and skips creation if found, then re-runs the rest of provisioning including credential handoff.

Click **Retry Provisioning** in the admin panel.

**Fix — manual XML-RPC (if retry doesn't work):**

Run on server:
```bash
python3 - << 'EOF'
import subprocess, re, urllib.request

# Get tenant's odooAdminPassword from control DB
r = subprocess.run(
    ['docker', 'exec', '-i', 'basetaa-odoo-deploy-db-1', 'psql',
     '-U', 'odoo', '-d', 'basetaa_control', '-t', '-c',
     'SELECT "odooAdminPassword" FROM tenants WHERE "normalizedSubdomain" = \'SUBDOMAIN\';'],
    capture_output=True, text=True
)
pwd = r.stdout.strip()
print(f'Admin password length: {len(pwd)}')

# Authenticate
auth_xml = f'''<?xml version="1.0"?>
<methodCall><methodName>authenticate</methodName><params>
  <param><value><string>tenant_SUBDOMAIN</string></value></param>
  <param><value><string>admin</string></value></param>
  <param><value><string>{pwd}</string></value></param>
  <param><value><struct/></value></param>
</params></methodCall>'''.encode()

req = urllib.request.Request('http://localhost:8069/xmlrpc/2/common', data=auth_xml, headers={'Content-Type': 'text/xml'})
resp = urllib.request.urlopen(req, timeout=10)
body = resp.read().decode()
m = re.search(r'<int>(\d+)</int>', body)
print('UID:', m.group(1) if m else 'AUTH FAILED')
EOF
```

---

### E. Tenant marked failed but DB actually exists

The reprovision route handles this gracefully:
- It calls `tenantDatabaseExists(dbName)` first
- If DB exists → skips creation → runs credential handoff → marks ready

Just click **Retry Provisioning** in the admin panel.

---

## After Successful Reprovision

Verify in admin panel:
- Provisioning badge changes to `ready`
- Odoo Workspace card appears with correct DB and login email
- Visit `https://{sub}.erp.basetaa.com` — should load Odoo login
- Log in with original signup credentials

---

## Manual DB Drop (if needed for a clean retry)

Only do this if you want to completely remove the tenant's Odoo DB and start fresh:

```bash
# First deactivate the tenant in admin panel (or update DB directly)

# Drop the Odoo DB
docker exec basetaa-odoo-deploy-db-1 dropdb -U odoo tenant_SUBDOMAIN

# Verify it's gone
docker exec basetaa-odoo-deploy-db-1 psql -U odoo -c "\l" | grep SUBDOMAIN

# Now reprovision from admin panel — DB doesn't exist → will create fresh
```
