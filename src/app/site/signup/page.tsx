'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignupForm() {
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    desiredSubdomain: '',
    password: '',
    planCode: searchParams.get('plan') ?? 'growth',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ workspaceUrl: string } | null>(null)
  const [subdomainPreview, setSubdomainPreview] = useState('')

  useEffect(() => {
    const slug = form.desiredSubdomain
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
    setSubdomainPreview(slug)
  }, [form.desiredSubdomain])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setFieldErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')
    setFieldErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors)
        setServerError(data.error ?? 'Something went wrong. Please try again.')
      } else {
        setSuccess({ workspaceUrl: data.workspaceUrl })
      }
    } catch {
      setServerError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-6">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Your workspace is ready!</h1>
          <p className="text-gray-600 mb-8">
            Your 14-day free trial has started. Sign in to your workspace to get started.
          </p>
          <a
            href={success.workspaceUrl}
            className="btn-primary py-3.5 px-8 text-base w-full justify-center"
          >
            Go to Your Workspace →
          </a>
          <p className="mt-4 text-sm text-gray-500">
            Workspace URL:{' '}
            <span className="font-mono text-brand-600">{success.workspaceUrl}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white px-6 py-16">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block text-xl font-bold text-brand-600 mb-6">
            Basetaa ERP
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Start your free trial</h1>
          <p className="text-gray-500">
            14 days free &nbsp;·&nbsp; No credit card &nbsp;·&nbsp; Full access
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
            🚀 100% launch discount — currently free for early users
          </div>
        </div>

        {/* Form card */}
        <div className="card shadow-sm">
          {serverError && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full name */}
            <div>
              <label className="label" htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                className={`input ${fieldErrors.fullName ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="Ahmed Al-Rashidi"
                value={form.fullName}
                onChange={e => set('fullName', e.target.value)}
                required
                autoComplete="name"
              />
              {fieldErrors.fullName && <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>}
            </div>

            {/* Company name */}
            <div>
              <label className="label" htmlFor="companyName">Company name</label>
              <input
                id="companyName"
                className={`input ${fieldErrors.companyName ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="Acme Trading LLC"
                value={form.companyName}
                onChange={e => set('companyName', e.target.value)}
                required
                autoComplete="organization"
              />
              {fieldErrors.companyName && <p className="mt-1 text-xs text-red-600">{fieldErrors.companyName}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="label" htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                className={`input ${fieldErrors.email ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="you@company.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                required
                autoComplete="email"
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
            </div>

            {/* Phone (optional) */}
            <div>
              <label className="label" htmlFor="phone">
                Phone <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                className="input"
                placeholder="+971 50 000 0000"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                autoComplete="tel"
              />
            </div>

            {/* Subdomain */}
            <div>
              <label className="label" htmlFor="desiredSubdomain">Workspace URL</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-transparent">
                <input
                  id="desiredSubdomain"
                  className={`flex-1 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none ${
                    fieldErrors.desiredSubdomain ? 'border-red-400' : ''
                  }`}
                  placeholder="acme"
                  value={form.desiredSubdomain}
                  onChange={e => set('desiredSubdomain', e.target.value)}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="flex items-center px-3 py-2.5 bg-gray-50 border-l border-gray-300 text-sm text-gray-500 select-none whitespace-nowrap">
                  .erp.basetaa.com
                </span>
              </div>
              {subdomainPreview && form.desiredSubdomain !== subdomainPreview && (
                <p className="mt-1 text-xs text-gray-500">
                  Will be saved as: <span className="font-mono text-brand-600">{subdomainPreview}</span>
                </p>
              )}
              {fieldErrors.desiredSubdomain && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.desiredSubdomain}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className={`input ${fieldErrors.password ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                required
                autoComplete="new-password"
              />
              {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
            </div>

            {/* Plan (hidden, passed from URL) */}
            <input type="hidden" name="planCode" value={form.planCode} />

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base mt-2"
            >
              {loading ? 'Setting up your workspace…' : 'Start Free Trial'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            By signing up you agree to our{' '}
            <a href="#" className="text-brand-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-brand-600 hover:underline">Privacy Policy</a>.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have a workspace?{' '}
          <a href="#" className="text-brand-600 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
