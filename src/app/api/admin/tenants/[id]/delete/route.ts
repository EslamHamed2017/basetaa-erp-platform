import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { dropOdooDatabase } from '@/lib/odoo-db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { confirm?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: params.id } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 })

  // Archive-first safety gate: tenant must be inactive before deletion is allowed.
  // Admin must explicitly deactivate first, which blocks workspace access.
  if (tenant.status !== 'inactive') {
    return NextResponse.json(
      { error: 'Tenant must be deactivated (status: inactive) before deletion.' },
      { status: 400 },
    )
  }

  // Require exact subdomain match as explicit confirmation.
  if (!body.confirm || body.confirm !== tenant.normalizedSubdomain) {
    return NextResponse.json(
      { error: `Confirmation text must exactly match the subdomain: "${tenant.normalizedSubdomain}"` },
      { status: 400 },
    )
  }

  // Drop the Odoo database first. If this fails, abort — do not leave a dangling
  // control record pointing to a DB that still exists.
  if (tenant.odooDb) {
    const drop = await dropOdooDatabase(tenant.odooDb)
    if (!drop.success) {
      return NextResponse.json(
        { error: `Failed to drop Odoo database "${tenant.odooDb}": ${drop.error}` },
        { status: 502 },
      )
    }
  }

  // Delete control DB record. Feature flags cascade-delete via schema relation.
  await prisma.tenant.delete({ where: { id: params.id } })

  console.log(
    `[admin] TENANT DELETED: id=${tenant.id} subdomain=${tenant.normalizedSubdomain} ` +
    `odooDb=${tenant.odooDb ?? 'none'} by=${session.user?.email ?? 'admin'}`,
  )

  return NextResponse.json({ success: true })
}
