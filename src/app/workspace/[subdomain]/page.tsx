import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import WorkspaceInactive from './WorkspaceInactive'
import WorkspacePending from './WorkspacePending'

export default async function WorkspacePage({ params }: { params: { subdomain: string } }) {
  const tenant = await prisma.tenant.findUnique({
    where: { normalizedSubdomain: params.subdomain },
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

  // Active/trial + ready: Nginx normally routes directly to Odoo.
  // This redirect is a safety fallback for requests that reach Next.js anyway.
  redirect(`https://${tenant.fullDomain}/web`)
}
