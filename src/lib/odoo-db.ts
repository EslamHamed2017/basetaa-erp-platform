import crypto from 'crypto'

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

  // Step 1: Authenticate as admin to obtain UID
  const authXml = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${escapeXml(dbName)}</string></value></param>
    <param><value><string>admin</string></value></param>
    <param><value><string>${escapeXml(odooAdminPassword)}</string></value></param>
    <param><value><struct/></value></param>
  </params>
</methodCall>`

  let authRes: Response
  try {
    authRes = await fetch(`${base}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: authXml,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Odoo XML-RPC unreachable: ${msg}` }
  }

  const authBody = await authRes.text()
  const uidMatch = authBody.match(/<int>(\d+)<\/int>/)
  if (!uidMatch) {
    return { success: false, error: 'Odoo XML-RPC authentication failed — no UID returned.' }
  }
  const uid = uidMatch[1]

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
// Not used in Reality Plan MVP — reserved for future delete-tenant action.

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

  if (res.status === 303 || res.status === 302 || res.status === 200) {
    return { success: true }
  }
  return { success: false, error: `Unexpected Odoo response: HTTP ${res.status}` }
}
