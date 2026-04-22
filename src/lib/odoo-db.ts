import crypto from 'crypto'
import { Pool }  from 'pg'

function getOdooUrl(): string {
  const url = process.env.ODOO_URL
  if (!url) throw new Error('ODOO_URL environment variable is not set.')
  return url.replace(/\/$/, '')
}

function getMasterPassword(): string {
  const pwd = process.env.ODOO_MASTER_PASSWORD
  if (!pwd) throw new Error('ODOO_MASTER_PASSWORD environment variable is not set.')
  return pwd
}

export function generateOdooAdminPassword(): string {
  return crypto.randomBytes(24).toString('base64url')
}

// ─── Verify a database is healthy (used after creation) ──────────────────────

async function verifyOdooDatabase(dbName: string): Promise<boolean> {
  // Confirm the DB appears in Odoo's list (proves it was created and is accessible).
  try {
    const res = await fetch(`${getOdooUrl()}/web/database/list`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    })
    if (!res.ok) return false
    const data = await res.json() as { result?: string[] }
    const list: string[] = data.result ?? (data as unknown as string[])
    return Array.isArray(list) && list.includes(dbName)
  } catch {
    return false
  }
}

// ─── Create a new Odoo database ──────────────────────────────────────────────

export async function createOdooDatabase(
  dbName: string,
  adminPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const body = new URLSearchParams({
    master_pwd:   getMasterPassword(),
    name:         dbName,
    login:        'admin',
    password:     adminPassword,
    lang:         'en_US',
    country_code: 'AE',
    phone:        '',
  })

  let res: Response
  try {
    res = await fetch(`${getOdooUrl()}/web/database/create`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
      // Odoo 17 redirects to /web on success — do not follow, just check status
      redirect: 'manual',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Odoo unreachable: ${msg}` }
  }

  // Odoo returns 303 redirect to /web on success, 200 with error HTML on failure
  if (res.status === 303 || res.status === 302 || res.status === 200) {
    // Distinguish success (redirect) from failure (200 with error body)
    if (res.status === 303 || res.status === 302) {
      // Verify the new database is actually serving before reporting success.
      // A newly created DB should immediately appear in the database list.
      const healthy = await verifyOdooDatabase(dbName)
      if (!healthy) {
        return { success: false, error: `Database "${dbName}" was created but Odoo is not serving it correctly. Check Odoo logs.` }
      }
      return { success: true }
    }
    // 200 may mean success (older Odoo) or an error page
    const text = await res.text()
    if (text.includes('already exists') || text.includes('already_exists')) {
      return { success: false, error: `Database "${dbName}" already exists.` }
    }
    if (text.includes('Invalid master password') || text.includes('AccessDenied')) {
      return { success: false, error: 'Invalid Odoo master password.' }
    }
    if (text.includes('database manager has been disabled') || text.includes('disabled by the administrator')) {
      return { success: false, error: 'Odoo database manager is disabled (list_db=False in odoo.conf).' }
    }
    if (text.includes('Database creation error')) {
      // Extract the actual error from the HTML for debugging
      const match = text.match(/Database creation error[^<]*/)
      return { success: false, error: match ? match[0] : 'Database creation error (unknown).' }
    }
    // Treat 200 without known error strings as success
    return { success: true }
  }

  return { success: false, error: `Unexpected Odoo response: HTTP ${res.status}` }
}

// ─── Check if an Odoo database exists ────────────────────────────────────────

export async function odooDatabaseExists(dbName: string): Promise<boolean> {
  let res: Response
  try {
    res = await fetch(`${getOdooUrl()}/web/database/list`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    })
  } catch {
    return false
  }

  if (!res.ok) return false

  try {
    const data = await res.json() as { result?: string[] }
    const list: string[] = data.result ?? (data as unknown as string[])
    return Array.isArray(list) && list.includes(dbName)
  } catch {
    return false
  }
}

// ─── Passlib-compatible pbkdf2-sha512 hash (Odoo 17 uses 600000 rounds) ─────

const AB64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function ab64encode(buf: Buffer): string {
  let result = ''
  for (let i = 0; i < buf.length; i += 3) {
    const b0 = buf[i]
    const b1 = i + 1 < buf.length ? buf[i + 1] : 0
    const b2 = i + 2 < buf.length ? buf[i + 2] : 0
    result += AB64[b0 >> 2]
    result += AB64[((b0 & 3) << 4) | (b1 >> 4)]
    result += AB64[((b1 & 15) << 2) | (b2 >> 6)]
    result += AB64[b2 & 63]
  }
  const rem = buf.length % 3
  if (rem === 1) return result.slice(0, -2)
  if (rem === 2) return result.slice(0, -1)
  return result
}

async function hashOdooPwd(password: string): Promise<string> {
  const rounds = 600000
  const salt   = crypto.randomBytes(16)
  const hash   = await new Promise<Buffer>((res, rej) =>
    crypto.pbkdf2(password, salt, rounds, 64, 'sha512', (e, k) => e ? rej(e) : res(k))
  )
  return `$pbkdf2-sha512$${rounds}$${ab64encode(salt)}$${ab64encode(hash)}`
}

// When XML-RPC auth fails (stale odooAdminPassword), write credentials directly to the tenant DB.
async function pgFallbackSetCredentials(
  dbName: string,
  userEmail: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) return { success: false, error: 'DATABASE_URL not set — cannot use pg fallback.' }

  const tenantUrl = baseUrl.replace(/\/[^/?]+(\?.*)?$/, `/${dbName}$1`)
  const pwdHash   = await hashOdooPwd(newPassword)
  const pool      = new Pool({ connectionString: tenantUrl, max: 1 })

  try {
    // Update login + password on the active admin (exclude uid=1 OdooBot)
    const r = await pool.query(
      `UPDATE res_users
          SET login    = $1,
              password = $2
        WHERE active = true
          AND id != 1
          AND (login = $1 OR login = 'admin')`,
      [userEmail, pwdHash],
    )
    if ((r.rowCount ?? 0) === 0) {
      return { success: false, error: 'pg fallback: no active admin user found in tenant DB.' }
    }

    // Also sync email on the linked res_partner record
    await pool.query(
      `UPDATE res_partner rp
          SET email = $1
         FROM res_users ru
        WHERE ru.partner_id = rp.id
          AND ru.active = true
          AND ru.id != 1
          AND (ru.login = $1 OR ru.login = 'admin')`,
      [userEmail],
    )

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `pg fallback failed: ${msg}` }
  } finally {
    await pool.end()
  }
}

// ─── Set Odoo tenant admin credentials via XML-RPC ───────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function setOdooTenantCredentials(
  dbName: string,
  odooAdminPassword: string,
  userEmail: string,
  userPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const base = getOdooUrl()

  // Step 1: Authenticate to obtain UID.
  // Try userEmail first (post-credential-handoff tenants have email as login),
  // then fall back to 'admin' (pre-handoff tenants provisioned with old flow).
  async function tryAuth(login: string): Promise<string | null> {
    const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${escapeXml(dbName)}</string></value></param>
    <param><value><string>${escapeXml(login)}</string></value></param>
    <param><value><string>${escapeXml(odooAdminPassword)}</string></value></param>
    <param><value><struct/></value></param>
  </params>
</methodCall>`
    try {
      const res = await fetch(`${base}/xmlrpc/2/common`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml,
      })
      const body = await res.text()
      // Match UID only (>1); faultCode responses also contain <int>1</int> which must be excluded
      const m = body.match(/<int>(\d+)<\/int>/)
      return m && parseInt(m[1]) > 1 ? m[1] : null
    } catch {
      return null
    }
  }

  let uid = await tryAuth(userEmail)
  if (!uid) uid = await tryAuth('admin')
  if (!uid) {
    // XML-RPC auth failed (stale odooAdminPassword). Fall back to direct pg write.
    return pgFallbackSetCredentials(dbName, userEmail, userPassword)
  }

  // Step 2: Write login, email, password on the admin res.users record
  const writeXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${escapeXml(dbName)}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${escapeXml(odooAdminPassword)}</string></value></param>
    <param><value><string>res.users</string></value></param>
    <param><value><string>write</string></value></param>
    <param><value><array><data>
      <value><array><data>
        <value><int>${uid}</int></value>
      </data></array></value>
      <value><struct>
        <member><name>login</name><value><string>${escapeXml(userEmail)}</string></value></member>
        <member><name>email</name><value><string>${escapeXml(userEmail)}</string></value></member>
        <member><name>password</name><value><string>${escapeXml(userPassword)}</string></value></member>
      </struct></value>
    </data></array></value></param>
    <param><value><struct/></value></param>
  </params>
</methodCall>`

  let writeRes: Response
  try {
    writeRes = await fetch(`${base}/xmlrpc/2/object`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: writeXml,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Odoo XML-RPC write unreachable: ${msg}` }
  }

  const writeBody = await writeRes.text()
  if (!writeBody.includes('<boolean>1</boolean>')) {
    return { success: false, error: `Odoo credential write failed. Response: ${writeBody.slice(0, 200)}` }
  }

  return { success: true }
}

// ─── Drop an Odoo database ────────────────────────────────────────────────────

export async function dropOdooDatabase(
  dbName: string,
): Promise<{ success: boolean; error?: string }> {
  const body = new URLSearchParams({
    master_pwd: getMasterPassword(),
    name:       dbName,
  })

  let res: Response
  try {
    res = await fetch(`${getOdooUrl()}/web/database/drop`, {
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:     body.toString(),
      redirect: 'manual',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Odoo unreachable: ${msg}` }
  }

  // Odoo 17 redirects on success; 200 means an error page was returned
  if (res.status === 303 || res.status === 302) {
    return { success: true }
  }

  if (res.status === 200) {
    const text = await res.text()
    if (text.includes('Invalid master password') || text.includes('AccessDenied')) {
      return { success: false, error: 'Invalid Odoo master password.' }
    }
    if (text.includes('database manager has been disabled')) {
      return { success: false, error: 'Odoo database manager is disabled.' }
    }
    if (text.includes('does not exist') || text.includes("doesn't exist")) {
      // DB already gone — treat as success to keep delete idempotent
      return { success: true }
    }
    return { success: false, error: `Odoo drop returned 200 (unexpected): ${text.slice(0, 200)}` }
  }

  return { success: false, error: `Unexpected Odoo response: HTTP ${res.status}` }
}
