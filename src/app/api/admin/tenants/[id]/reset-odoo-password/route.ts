import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { setOdooTenantCredentials } from '@/lib/odoo-db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const newPassword = (body.newPassword ?? '').trim()
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: params.id } })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 })

  if (!tenant.odooDb || !tenant.odooAdminPassword) {
    return NextResponse.json(
      { error: 'Tenant has no provisioned Odoo database — provisioning may have failed.' },
      { status: 400 },
    )
  }

  const result = await setOdooTenantCredentials(
    tenant.odooDb,
    tenant.odooAdminPassword,
    tenant.email,
    newPassword,
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Password reset failed.' }, { status: 502 })
  }

  // Keep odooAdminPassword in sync — it is the current credential for service XML-RPC auth.
  await prisma.tenant.update({
    where: { id: params.id },
    data: { odooAdminPassword: newPassword },
  })

  console.log(
    `[admin] Odoo password reset: tenant=${tenant.id} subdomain=${tenant.normalizedSubdomain} by=${session.user?.email ?? 'admin'}`,
  )
  return NextResponse.json({ success: true })
}
