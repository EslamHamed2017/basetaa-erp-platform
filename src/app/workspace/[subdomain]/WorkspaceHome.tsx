interface Props {
  tenant: {
    companyName: string
    fullName: string
    email: string
    planName: string
    trialEndAt: Date | null
    status: string
  }
}

const MODULES = [
  { icon: '📊', label: 'Accounting',   desc: 'Ledger, invoices, payments' },
  { icon: '🛒', label: 'Sales & CRM',  desc: 'Pipeline, quotations, orders' },
  { icon: '📦', label: 'Inventory',    desc: 'Stock, warehouses, transfers' },
  { icon: '👥', label: 'HR & Payroll', desc: 'Employees, leave, payroll' },
  { icon: '📋', label: 'Operations',   desc: 'Workflows, approvals, tasks' },
  { icon: '📈', label: 'Reports',      desc: 'Dashboards, analytics, exports' },
]

export default function WorkspaceHome({ tenant }: Props) {
  const trialDaysLeft = tenant.trialEndAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndAt).getTime() - Date.now()) / 86_400_000))
    : null

  const showTrialBanner = tenant.status === 'trial' && trialDaysLeft !== null

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="font-bold text-brand-600 text-base">{tenant.companyName}</span>
            </div>
            <span className="hidden sm:block w-px h-4 bg-gray-200"></span>
            <span className="hidden sm:block text-xs text-gray-400 font-medium">Basetaa ERP</span>
          </div>
          <div className="flex items-center gap-3">
            {showTrialBanner && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                trialDaysLeft! <= 3
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : trialDaysLeft! <= 7
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                {trialDaysLeft}d trial remaining
              </span>
            )}
            <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-xs font-bold text-brand-700">
                {tenant.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Trial expiry warning */}
        {showTrialBanner && trialDaysLeft! <= 7 && (
          <div className={`mb-8 p-4 rounded-xl border flex items-start gap-3 ${
            trialDaysLeft! <= 3
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <span className="text-lg mt-0.5">⏰</span>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${trialDaysLeft! <= 3 ? 'text-red-800' : 'text-amber-800'}`}>
                Your trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}
              </p>
              <p className={`text-sm mt-0.5 ${trialDaysLeft! <= 3 ? 'text-red-600' : 'text-amber-700'}`}>
                Contact us at{' '}
                <a href="mailto:hello@basetaa.com" className="underline font-medium">
                  hello@basetaa.com
                </a>{' '}
                to activate your subscription and keep full access.
              </p>
            </div>
          </div>
        )}

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {tenant.fullName.split(' ')[0]}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {tenant.companyName} &nbsp;·&nbsp; {tenant.planName} plan
            {tenant.status === 'trial' && trialDaysLeft !== null && (
              <> &nbsp;·&nbsp; <span className="text-blue-600">{trialDaysLeft} days left in trial</span></>
            )}
          </p>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          {MODULES.map((m) => (
            <a
              key={m.label}
              href="#"
              className="card flex flex-col items-center text-center py-6 px-3 gap-2.5 hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
            >
              <span className="text-2xl">{m.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-600 transition-colors">{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{m.desc}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Dashboard placeholder */}
        <div className="card border-dashed text-center py-16">
          <p className="text-gray-300 text-sm font-medium">Dashboard coming soon</p>
          <p className="text-gray-300 text-xs mt-1">Your key metrics will appear here</p>
        </div>
      </main>
    </div>
  )
}
