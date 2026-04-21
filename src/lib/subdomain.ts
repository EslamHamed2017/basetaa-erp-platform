// Reserved subdomains that cannot be used as tenant identifiers
export const RESERVED_SUBDOMAINS = new Set([
  'erp', 'www', 'control', 'api', 'mail', 'ftp', 'admin',
  'app', 'dev', 'staging', 'test', 'demo', 'help', 'support',
  'billing', 'status', 'docs', 'blog', 'cdn', 'assets',
])

// Normalize a subdomain: lowercase, strip non-alphanumeric (except hyphens), trim
export function normalizeSubdomain(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')   // replace invalid chars with hyphens
    .replace(/-+/g, '-')            // collapse consecutive hyphens
    .replace(/^-|-$/g, '')          // strip leading/trailing hyphens
}

export interface SubdomainValidation {
  valid: boolean
  normalized: string
  error?: string
}

export function validateSubdomain(raw: string): SubdomainValidation {
  const normalized = normalizeSubdomain(raw)

  if (!normalized || normalized.length < 3) {
    return { valid: false, normalized, error: 'Subdomain must be at least 3 characters.' }
  }

  if (normalized.length > 32) {
    return { valid: false, normalized, error: 'Subdomain must be 32 characters or fewer.' }
  }

  if (RESERVED_SUBDOMAINS.has(normalized)) {
    return { valid: false, normalized, error: `"${normalized}" is a reserved name and cannot be used.` }
  }

  if (!/^[a-z0-9]/.test(normalized) || !/[a-z0-9]$/.test(normalized)) {
    return { valid: false, normalized, error: 'Subdomain must start and end with a letter or number.' }
  }

  // Hyphens are rejected: Odoo dbfilter uses %d (first hostname component) to match
  // the database name, and we store DBs as tenant_{subdomain}. If the subdomain contains
  // hyphens, %d gives "my-company" but the DB is "tenant_my_company" — no match.
  if (normalized.includes('-')) {
    return { valid: false, normalized, error: 'Subdomain may only contain letters and numbers.' }
  }

  return { valid: true, normalized }
}

// Build the full workspace domain from a normalized subdomain
export function buildWorkspaceDomain(normalizedSubdomain: string): string {
  const base = process.env.BASE_DOMAIN ?? 'erp.basetaa.com'
  return `${normalizedSubdomain}.${base}`
}

// Build the tenant database name from a normalized subdomain
export function buildDbName(normalizedSubdomain: string): string {
  // Use prefix to avoid collisions with system databases
  return `tenant_${normalizedSubdomain.replace(/-/g, '_')}`
}
