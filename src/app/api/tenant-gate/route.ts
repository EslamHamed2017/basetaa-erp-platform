import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  // Only allow calls from Nginx internal subrequests
  if (req.headers.get('x-nginx-internal') !== '1') {
    return new NextResponse(null, { status: 403 })
  }

  const sub = req.nextUrl.searchParams.get('sub')
  if (!sub) return new NextResponse(null, { status: 404 })

  const tenant = await prisma.tenant.findUnique({
    where: { normalizedSubdomain: sub },
    select: { status: true, provisioningState: true, odooDb: true },
  })

  // nginx auth_request only supports 2xx (allow) or 401/403 (deny).
  // Return 200 for active+ready tenants, 403 for everything else.
  // Next.js workspace page handles the detailed state UI.
  if (!tenant || tenant.status === 'inactive' || tenant.provisioningState !== 'ready') {
    return new NextResponse(null, { status: 403 })
  }

  // provisioningState === 'ready' and status is trial or active
  return new NextResponse(null, {
    status: 200,
    headers: { 'X-Odoo-Db': tenant.odooDb ?? `tenant_${sub}` },
  })
}
