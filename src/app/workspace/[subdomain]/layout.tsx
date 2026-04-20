import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

export async function generateMetadata({ params }: { params: { subdomain: string } }): Promise<Metadata> {
  const tenant = await prisma.tenant.findUnique({
    where: { normalizedSubdomain: params.subdomain },
    select: { companyName: true },
  })
  return {
    title: tenant ? `${tenant.companyName} — Basetaa ERP` : 'Workspace — Basetaa ERP',
  }
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
