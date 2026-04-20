import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import WorkspaceInactive from './WorkspaceInactive'
import WorkspacePending from './WorkspacePending'
import WorkspaceHome from './WorkspaceHome'

export default async function WorkspacePage({ params }: { params: { subdomain: string } }) {
  const tenant = await prisma.tenant.findUnique({
    where: { normalizedSubdomain: params.subdomain },
    include: { plan: { select: { name: true } } },
  })

  if (!tenant) notFound()

  if (tenant.status === 'inactive') {
    return <WorkspaceInactive companyName={tenant.companyName} />
  }

  if (tenant.status === 'pending' || tenant.provisioningState !== 'ready') {
    return <WorkspacePending
      companyName={tenant.companyName}
      hasFailed={tenant.provisioningState === 'failed'}
    />
  }

  return <WorkspaceHome tenant={{
    companyName: tenant.companyName,
    fullName: tenant.fullName,
    email: tenant.email,
    planName: tenant.plan.name,
    trialEndAt: tenant.trialEndAt ?? null,
    status: tenant.status,
  }} />
}
