import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'
import TenantActions from './TenantActions'

export const metadata: Metadata = { title: 'Tenant Detail' }

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-yellow-50 text-yellow-700 border border-yellow-200',
  trial:    'bg-blue-50 text-blue-700 border border-blue-200',
  active:   'bg-green-50 text-green-700 border border-green-200',
  inactive: 'bg-gray-100 text-gray-500 border border-gray-200',
}

const PROV_BADGE: Record<string, string> = {
  pending:      'bg-gray-50 text-gray-500 border border-gray-200',
  provisioning: 'bg-blue-50 text-blue-600 border border-blue-200',
  ready:        'bg-green-50 text-green-600 border border-green-200',
  failed:       'bg-red-50 text-red-600 border border-red-200',
}

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: { plan: true, featureFlags: true },
  })
  if (!tenant) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/tenants" className="text-gray-400 hover:text-gray-700 transition-colors">
              Tenants
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-700 font-medium">{tenant.companyName}</span>
          </div>
          <a href="/api/auth/signout" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            Sign out
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{tenant.companyName}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{tenant.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[tenant.status] ?? STATUS_BADGE.inactive}`}>
              {tenant.status}
            </span>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${PROV_BADGE[tenant.provisioningState] ?? PROV_BADGE.pending}`}>
              {tenant.provisioningState}
            </span>
          </div>
        </div>

        {/* Details grid */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-5 pb-3 border-b border-gray-100">
            Tenant Details
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
            {([
              ['ID',           <span key="id" className="font-mono text-xs text-gray-500">{tenant.id}</span>],
              ['Owner',        tenant.fullName],
              ['Email',        tenant.email],
              ['Phone',        tenant.phone ?? '—'],
              ['Company',      tenant.companyName],
              ['Subdomain',    <span key="sd" className="font-mono text-xs text-brand-600">{tenant.normalizedSubdomain}.erp.basetaa.com</span>],
              ['Database',     <span key="db" className="font-mono text-xs text-gray-500">{tenant.dbName}</span>],
              ['Plan',         tenant.plan.name],
              ['Price',        `AED ${Number(tenant.finalPriceAed).toFixed(2)} / mo`],
              ['Pricing note', tenant.pricingLabel ?? '—'],
              ['Trial start',  tenant.trialStartAt ? new Date(tenant.trialStartAt).toLocaleString('en-AE') : '—'],
              ['Trial end',    tenant.trialEndAt   ? new Date(tenant.trialEndAt).toLocaleString('en-AE')   : '—'],
              ['Created',      new Date(tenant.createdAt).toLocaleString('en-AE')],
              ['Updated',      new Date(tenant.updatedAt).toLocaleString('en-AE')],
            ] as [string, React.ReactNode][]).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</dt>
                <dd className="text-sm text-gray-800">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Provisioning error */}
        {tenant.provisioningError && (
          <div className="card border-red-200 bg-red-50">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-red-500 text-sm font-semibold">Provisioning Error</span>
              <span className="text-xs bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">action required</span>
            </div>
            <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono bg-red-100/60 rounded-lg p-4 leading-relaxed">
              {tenant.provisioningError}
            </pre>
          </div>
        )}

        {/* Feature flags (if any) */}
        {tenant.featureFlags.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Feature Flags</h2>
            <div className="space-y-2">
              {tenant.featureFlags.map(f => (
                <div key={f.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <span className="font-mono text-xs text-gray-600">{f.flagKey}</span>
                  <span className="font-mono text-xs text-gray-400">{f.flagValue}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <TenantActions tenant={{
          id: tenant.id,
          status: tenant.status,
          provisioningState: tenant.provisioningState,
          isActive: tenant.isActive,
        }} />
      </main>
    </div>
  )
}
