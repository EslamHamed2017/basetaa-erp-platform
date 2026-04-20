import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tenants' }

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

export default async function TenantsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { plan: { select: { name: true } } },
  })

  const counts = {
    total:    tenants.length,
    trial:    tenants.filter(t => t.status === 'trial').length,
    active:   tenants.filter(t => t.status === 'active').length,
    failed:   tenants.filter(t => t.provisioningState === 'failed').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-brand-600">Basetaa</span>
            <span className="text-gray-300 text-sm font-medium">ERP</span>
            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">Admin</span>
          </div>
          <a
            href="/api/auth/signout"
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Sign out
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage workspaces and provisioning</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total',    value: counts.total,  color: 'text-gray-900' },
            { label: 'Trial',    value: counts.trial,  color: 'text-blue-600' },
            { label: 'Active',   value: counts.active, color: 'text-green-600' },
            { label: 'Failed',   value: counts.failed, color: counts.failed > 0 ? 'text-red-600' : 'text-gray-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {tenants.length === 0 ? (
          <div className="card text-center py-20">
            <p className="text-gray-400 text-sm">No tenants yet. Signups will appear here.</p>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Company / Owner</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Workspace</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Plan</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Provisioning</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Trial ends</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 text-sm">{t.companyName}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{t.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <a
                        href={`https://${t.fullDomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-brand-600 hover:underline"
                      >
                        {t.normalizedSubdomain}
                      </a>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{t.plan.name}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[t.status] ?? STATUS_BADGE.inactive}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PROV_BADGE[t.provisioningState] ?? PROV_BADGE.pending}`}>
                        {t.provisioningState}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {t.trialEndAt ? new Date(t.trialEndAt).toLocaleDateString('en-AE') : '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {new Date(t.createdAt).toLocaleDateString('en-AE')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/tenants/${t.id}`}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
