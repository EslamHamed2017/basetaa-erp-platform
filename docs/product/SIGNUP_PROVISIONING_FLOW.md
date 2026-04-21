# Signup → Provisioning → Odoo DB Creation → Routing Flow

---

## Complete Step-by-Step Flow

### 1. User submits signup form

**Endpoint:** `POST https://erp.basetaa.com/api/signup`  
**Handler:** `src/app/api/signup/route.ts` → `src/lib/provisioning.ts:provisionTenant()`

**Input fields:**
```json
{
  "fullName": "Eslam Hamed",
  "companyName": "Acme Corp",
  "email": "eslam@acme.com",
  "phone": "+971501234567",
  "desiredSubdomain": "acme",
  "password": "StrongPass123!",
  "planCode": "growth"
}
```

---

### 2. Input validation

- Zod schema: all fields validated (type, length, format)
- `email` → must be valid email format
- `password` → min 8, max 128 chars
- `desiredSubdomain` → min 3, max 40 chars
- Failure → HTTP 422 with `fieldErrors` map

---

### 3. Subdomain normalization

`src/lib/subdomain.ts:validateSubdomain()`

- Lowercased
- Spaces → hyphens
- Non-alphanumeric/hyphen chars stripped
- Must be 3–40 chars after normalization
- Must not be reserved: `erp`, `www`, `control`, `api`, `mail`, `ftp`, `admin`
- `buildDbName()` → `tenant_{normalizedSubdomain}` (hyphens become underscores)

Example: `"Acme Corp"` → normalized: `"acme-corp"` → dbName: `"tenant_acme_corp"`

---

### 4. Uniqueness check

Two parallel DB queries:
- `prisma.tenant.findUnique({ where: { email } })` — fail if exists
- `prisma.tenant.findUnique({ where: { normalizedSubdomain } })` — fail if exists

---

### 5. Plan resolution

`prisma.plan.findUnique({ where: { code: planCode } })`

Failure → HTTP 422 `'Invalid plan selected.'`

---

### 6. Password hashing

`bcrypt.hash(password, 12)` — 12 rounds

Plain text `password` is kept in scope temporarily for the Odoo credential handoff in step 9.

---

### 7. Tenant record created (provisioning state)

```prisma
prisma.tenant.create({
  status: 'pending',
  provisioningState: 'provisioning',
  isActive: false,
  ...allFields
})
```

At this point the tenant exists in the DB but is not active.

---

### 8. Odoo database creation

`src/lib/odoo-db.ts:createOdooDatabase(dbName, adminPassword)`

```
POST http://localhost:8069/web/database/create
Content-Type: application/x-www-form-urlencoded

master_pwd={ODOO_MASTER_PASSWORD}
name=tenant_acme
login=admin
password={randomBase64url}
lang=en_US
country_code=AE
phone=
```

**Odoo response handling:**
- HTTP 302/303 → success (Odoo redirects to `/web` on success)
- HTTP 200 with `already exists` → treated as success (safe re-provisioning)
- HTTP 200 with `Invalid master password` → fail
- HTTP 200 with `database manager has been disabled` → fail
- HTTP 200 with `Database creation error` → fail

**Timing:** ~12 seconds for Odoo to create and seed the database with the `base` module.

---

### 9. Odoo credential handoff

`src/lib/odoo-db.ts:setOdooTenantCredentials(dbName, adminPassword, userEmail, userPassword)`

**Step 9a — Authenticate (XML-RPC):**
```xml
POST http://localhost:8069/xmlrpc/2/common
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>tenant_acme</string></value></param>   <!-- db -->
    <param><value><string>admin</string></value></param>          <!-- login -->
    <param><value><string>{adminPassword}</string></value></param><!-- password -->
    <param><value><struct/></value></param>                        <!-- options -->
  </params>
</methodCall>
```
Response: `<int>2</int>` (UID of the admin user)

**Step 9b — Write user credentials (XML-RPC):**
```xml
POST http://localhost:8069/xmlrpc/2/object
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <!-- db, uid, password, model, method, args, kwargs -->
    <!-- res.users.write([uid], {login, email, password}) -->
  </params>
</methodCall>
```
Response: `<boolean>1</boolean>` on success

Odoo auto-hashes the password server-side. After this, the user's signup credentials are the Odoo admin credentials.

---

### 10. Tenant record finalized

```prisma
prisma.tenant.update({
  provisioningState: 'ready',
  status: 'trial',
  isActive: true,
  provisioningError: null,
  odooDb: 'tenant_acme',
  odooAdminPassword: '{randomBase64url}',
  odooModules: ['base'],
})
```

---

### 11. Response returned to user

```json
HTTP 201
{
  "success": true,
  "tenantId": "cmo8vzzny0001...",
  "workspaceUrl": "https://acme.erp.basetaa.com"
}
```

---

### 12. Tenant workspace routing (on first visit)

```
GET https://acme.erp.basetaa.com/
  │
  Nginx: server_name ~^(?P<sub>[a-z0-9]+)\.erp\.basetaa\.com$
  Nginx: auth_request /_tenant_gate
    │
    subrequest: GET http://localhost:3000/api/tenant-gate?sub=acme
                    (+ header X-Nginx-Internal: 1)
    │
    src/app/api/tenant-gate/route.ts:
      SELECT status, provisioningState, odooDb FROM tenants WHERE normalizedSubdomain='acme'
      → status=trial, provisioningState=ready → return HTTP 200
         header: X-Odoo-Db: tenant_acme
    │
    Nginx: 200 received → proxy_pass http://odoo (localhost:8069)
    │
    Odoo: receives Host: acme.erp.basetaa.com
          dbfilter ^tenant_%d$ → matches %d='acme' → serves tenant_acme
    │
    User sees: Odoo login page for their company
```

---

## Failure Path

If any step from 8 onwards throws:

```prisma
prisma.tenant.update({
  provisioningState: 'failed',
  provisioningError: '{error message}',
  status: 'pending',
})
```

Response to user:
```json
HTTP 201
{
  "success": true,
  "tenantId": "...",
  "workspaceUrl": "https://acme.erp.basetaa.com",
  "error": "Workspace created but provisioning is pending. We will notify you when it is ready."
}
```

Admin can then reprovision from the control panel → `POST /api/admin/tenants/{id}/reprovision`.

---

## Reprovision Flow

`src/lib/provisioning.ts:reprovisionTenant(tenantId)`

1. Mark `provisioningState=provisioning`
2. Use `tenant.odooAdminPassword` if stored, else generate new one
3. Check if DB exists — skip creation if it does
4. Run `createTenantDatabase()` if DB missing
5. Run `seedTenantDatabase()` (no-op — Odoo self-seeds)
6. Mark `provisioningState=ready`, `status=trial`, `isActive=true`

> **Note:** Credential handoff is NOT re-run on reprovision. The user's original Odoo password (set during initial provisioning, if it succeeded) remains. If the original handoff also failed, the admin must manually reset the Odoo password.
