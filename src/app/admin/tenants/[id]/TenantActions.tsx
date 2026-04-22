'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tenant: {
    id: string
    status: string
    provisioningState: string
    isActive: boolean
    normalizedSubdomain: string
    companyName: string
    odooDb: string | null
  }
}

type Panel = 'none' | 'deactivate' | 'reset-password' | 'delete'

export default function TenantActions({ tenant }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [panel, setPanel] = useState<Panel>('none')

  // Reset password state
  const [newPassword, setNewPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState('')

  function openPanel(p: Panel) {
    setPanel(p)
    setError('')
    setSuccess('')
    setNewPassword('')
    setShowPwd(false)
    setDeleteConfirm('')
  }

  function closePanel() {
    openPanel('none')
  }

  async function call(action: string, body?: Record<string, string>) {
    setError('')
    setSuccess('')
    setLoading(action)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/${action}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Action failed.')
      } else {
        if (action === 'delete') {
          router.push('/tenants')
        } else if (action === 'reset-odoo-password') {
          setSuccess('Odoo password reset successfully. The tenant can now log in with the new password.')
          setNewPassword('')
          setShowPwd(false)
        } else {
          closePanel()
          router.refresh()
        }
      }
    } catch {
      setError('Network error.')
    } finally {
      setLoading(null)
    }
  }

  const canActivate    = tenant.status !== 'active' && tenant.provisioningState === 'ready'
  const canDeactivate  = tenant.status === 'active' || tenant.status === 'trial'
  const canReprovision = tenant.provisioningState === 'failed'
  const canResetPwd    = !!tenant.odooDb
  const canDelete      = tenant.status === 'inactive'

  const anyAction = canActivate || canDeactivate || canReprovision || canResetPwd

  return (
    <div className="card space-y-5">
      <h2 className="font-semibold text-gray-900">Actions</h2>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* ── Primary actions ── */}
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

        {canDeactivate && panel !== 'deactivate' && (
          <button
            onClick={() => openPanel('deactivate')}
            disabled={loading !== null}
            className="btn-secondary py-2 px-4 text-sm"
          >
            Deactivate
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

        {canResetPwd && panel !== 'reset-password' && (
          <button
            onClick={() => openPanel('reset-password')}
            disabled={loading !== null}
            className="btn-secondary py-2 px-4 text-sm"
          >
            Reset Odoo Password
          </button>
        )}

        {!anyAction && (
          <p className="text-sm text-gray-500">No actions available for the current state.</p>
        )}
      </div>

      {/* ── Deactivate confirmation panel ── */}
      {panel === 'deactivate' && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
          <p className="text-sm text-amber-800">
            <strong>Deactivate {tenant.companyName}?</strong>{' '}
            Their workspace will become inaccessible until explicitly reactivated.
          </p>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => call('deactivate')}
              disabled={loading !== null}
              className="btn-secondary py-1.5 px-4 text-sm border-amber-300 text-amber-800 hover:bg-amber-100"
            >
              {loading === 'deactivate' ? 'Deactivating…' : 'Confirm Deactivate'}
            </button>
            <button onClick={closePanel} className="text-sm text-gray-500 hover:text-gray-700 px-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Reset Odoo password panel ── */}
      {panel === 'reset-password' && (
        <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800">
              Reset Odoo Password —{' '}
              <span className="font-mono text-brand-600">{tenant.normalizedSubdomain}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Changes the password the tenant uses to log into their Odoo workspace at{' '}
              <span className="font-mono">{tenant.normalizedSubdomain}.erp.basetaa.com</span>.
              Their login email ({/* shown in workspace card */} email on file) remains unchanged.
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 pr-14 w-64"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>
            <button
              onClick={() => call('reset-odoo-password', { newPassword })}
              disabled={loading !== null || newPassword.length < 8}
              className="btn-primary py-1.5 px-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading === 'reset-odoo-password' ? 'Resetting…' : 'Reset Password'}
            </button>
            <button onClick={closePanel} className="text-sm text-gray-500 hover:text-gray-700 px-2">
              Cancel
            </button>
          </div>
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-xs text-red-500">Password must be at least 8 characters.</p>
          )}
        </div>
      )}

      {/* ── Danger Zone ── */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Danger Zone
        </p>

        {!canDelete ? (
          <p className="text-xs text-gray-400">
            Deletion requires the tenant to be <strong>inactive</strong>. Deactivate first to
            block workspace access, then return here to delete.
          </p>
        ) : panel !== 'delete' ? (
          <button
            onClick={() => openPanel('delete')}
            disabled={loading !== null}
            className="text-sm text-red-600 border border-red-200 rounded-md px-4 py-1.5 hover:bg-red-50 transition-colors"
          >
            Delete Tenant…
          </button>
        ) : (
          /* ── Delete confirmation panel ── */
          <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-4">
            <p className="text-sm font-semibold text-red-800">Delete Tenant Permanently</p>

            <div className="text-xs text-red-700 space-y-1.5 bg-red-100/60 rounded-md p-3">
              <p>
                <span className="text-red-500 font-medium">Company:</span>{' '}
                <strong>{tenant.companyName}</strong>
              </p>
              <p>
                <span className="text-red-500 font-medium">Subdomain:</span>{' '}
                <strong className="font-mono">{tenant.normalizedSubdomain}.erp.basetaa.com</strong>
              </p>
              {tenant.odooDb && (
                <p>
                  <span className="text-red-500 font-medium">Odoo DB:</span>{' '}
                  <strong className="font-mono">{tenant.odooDb}</strong>{' '}
                  <span className="text-red-600">— will be permanently dropped</span>
                </p>
              )}
            </div>

            <p className="text-xs text-red-700">
              This is <strong>irreversible</strong>. All Odoo data for this tenant will be
              permanently lost. The subdomain and database name cannot be reused.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-red-700 block">
                Type{' '}
                <strong className="font-mono bg-red-100 px-1 rounded">
                  {tenant.normalizedSubdomain}
                </strong>{' '}
                to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={tenant.normalizedSubdomain}
                className="border border-red-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 w-full max-w-xs"
              />
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={() => call('delete', { confirm: deleteConfirm })}
                disabled={loading !== null || deleteConfirm !== tenant.normalizedSubdomain}
                className="text-sm bg-red-600 text-white rounded-md px-4 py-1.5 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading === 'delete' ? 'Deleting…' : 'Delete Permanently'}
              </button>
              <button
                onClick={closePanel}
                className="text-sm text-gray-500 hover:text-gray-700 px-3"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
