'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tenant: {
    id: string
    status: string
    provisioningState: string
    isActive: boolean
  }
}

export default function TenantActions({ tenant }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function call(action: string) {
    setError('')
    setLoading(action)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Action failed.')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error.')
    } finally {
      setLoading(null)
    }
  }

  // Only allow activate when DB is ready — activating a failed-provisioning tenant
  // would set isActive=true but the workspace DB doesn't exist yet.
  const canActivate    = tenant.status !== 'active' && tenant.provisioningState === 'ready'
  const canDeactivate  = tenant.status === 'active' || tenant.status === 'trial'
  const canReprovision = tenant.provisioningState === 'failed'

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {canActivate && (
          <button
            onClick={() => call('activate')}
            disabled={loading !== null}
            className="btn-primary py-2 px-4 text-sm"
          >
            {loading === 'activate' ? 'Activating…' : 'Activate'}
          </button>
        )}
        {canDeactivate && (
          <button
            onClick={() => call('deactivate')}
            disabled={loading !== null}
            className="btn-secondary py-2 px-4 text-sm"
          >
            {loading === 'deactivate' ? 'Deactivating…' : 'Deactivate'}
          </button>
        )}
        {canReprovision && (
          <button
            onClick={() => call('reprovision')}
            disabled={loading !== null}
            className="btn-secondary py-2 px-4 text-sm"
          >
            {loading === 'reprovision' ? 'Reprovisioning…' : 'Retry Provisioning'}
          </button>
        )}
        {!canActivate && !canDeactivate && !canReprovision && (
          <p className="text-sm text-gray-500">No actions available for the current state.</p>
        )}
      </div>
    </div>
  )
}
