import { NextRequest, NextResponse } from 'next/server'

// Subdomains that are part of the platform, not tenant workspaces
const RESERVED = new Set(['erp', 'www', 'control', 'api', 'mail', 'ftp', 'admin'])

function extractSubdomain(host: string, baseDomain: string): string | null {
  const hostname = host.split(':')[0]

  // Bare localhost — public site
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null

  // Local dev: *.localhost (e.g. control.localhost, acme.localhost)
  // Works natively in Chrome/Firefox without a hosts-file entry.
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, hostname.length - '.localhost'.length)
    return sub || null
  }

  // Production: strip base domain suffix
  const suffix = `.${baseDomain}`
  if (!hostname.endsWith(suffix)) return null

  const sub = hostname.slice(0, hostname.length - suffix.length)
  return sub || null
}

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const baseDomain = process.env.BASE_DOMAIN ?? 'erp.basetaa.com'
  const subdomain = extractSubdomain(host, baseDomain)
  const { pathname } = req.nextUrl

  // Pass through Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
  }

  // ── Admin app ─────────────────────────────────────────────────────────────
  if (subdomain === 'control') {
    const url = req.nextUrl.clone()
    url.pathname = `/admin${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  // ── Public site ───────────────────────────────────────────────────────────
  if (!subdomain || subdomain === 'erp') {
    const url = req.nextUrl.clone()
    url.pathname = `/site${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  // ── Tenant workspace ─────────────────────────────────────────────────────
  // Reserved subdomains that slipped through — treat as 404
  if (RESERVED.has(subdomain)) {
    const url = req.nextUrl.clone()
    url.pathname = '/site'
    return NextResponse.rewrite(url)
  }

  const url = req.nextUrl.clone()
  url.pathname = `/workspace/${subdomain}${pathname === '/' ? '' : pathname}`
  // Pass subdomain as header so server components can read it without re-parsing
  const res = NextResponse.rewrite(url)
  res.headers.set('x-tenant-subdomain', subdomain)
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
