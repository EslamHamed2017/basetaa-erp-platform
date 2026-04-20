import Link from 'next/link'
import { prisma } from '@/lib/prisma'

async function getPlans() {
  try {
    return await prisma.plan.findMany({ orderBy: { listPriceAed: 'asc' } })
  } catch {
    return []
  }
}

const FEATURES = [
  {
    icon: '📊',
    title: 'Accounting & Finance',
    desc: 'Double-entry accounting, invoicing, payments, and financial reports — structured and audit-ready.',
  },
  {
    icon: '🛒',
    title: 'Sales & CRM',
    desc: 'Pipeline management, quotations, sales orders, and customer records in one place.',
  },
  {
    icon: '📦',
    title: 'Inventory & Purchasing',
    desc: 'Real-time stock visibility, vendor management, and automated purchase workflows.',
  },
  {
    icon: '👥',
    title: 'HR & Employees',
    desc: 'Employee records, leave management, and payroll built for structured, growing teams.',
  },
  {
    icon: '📋',
    title: 'Operations & Workflows',
    desc: 'Custom workflows, approval chains, and operational processes tailored to your business.',
  },
  {
    icon: '📈',
    title: 'Reports & Dashboards',
    desc: 'Live dashboards and cross-functional reports that give you clarity at every level.',
  },
]

export default async function LandingPage() {
  const plans = await getPlans()

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-brand-600 tracking-tight">Basetaa</span>
            <span className="text-lg font-semibold text-gray-400 tracking-tight">ERP</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hidden sm:block text-sm text-gray-500 hover:text-gray-800 transition-colors">Features</a>
            <a href="#pricing" className="hidden sm:block text-sm text-gray-500 hover:text-gray-800 transition-colors">Pricing</a>
            <Link href="/signup" className="btn-primary text-sm py-2 px-5">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-28 px-6 text-center bg-gradient-to-b from-brand-50 via-brand-50/40 to-white">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold mb-8 tracking-wide uppercase">
            Early Access — 100% Free for First Users
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-6">
            ERP built for<br />
            <span className="text-brand-600">growing businesses.</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 leading-relaxed max-w-xl mx-auto">
            Structured operations, cleaner workflows, and a scalable foundation — without the legacy complexity.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="btn-primary py-3.5 px-8 text-base shadow-sm shadow-brand-200">
              Start Your Free Trial
            </Link>
            <a href="#features" className="btn-secondary py-3.5 px-8 text-base">
              See What's Included
            </a>
          </div>
          <p className="mt-5 text-sm text-gray-400">
            No credit card &nbsp;·&nbsp; 14-day trial &nbsp;·&nbsp; Full access from day one
          </p>
        </div>
      </section>

      {/* ── Social proof strip ───────────────────────────────────────────── */}
      <section className="py-10 px-6 border-y border-gray-100 bg-gray-50/60">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-center gap-8 text-center sm:text-left">
          {[
            { stat: '14-day', label: 'free trial, full access' },
            { stat: 'AED 0', label: 'to get started today' },
            { stat: 'UAE', label: 'focused, globally ready' },
          ].map(({ stat, label }) => (
            <div key={stat} className="flex flex-col sm:flex-row items-center gap-2">
              <span className="text-2xl font-extrabold text-brand-600">{stat}</span>
              <span className="text-sm text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Explainer ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">One system. Every workflow.</h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            Basetaa ERP brings accounting, sales, purchasing, inventory, and HR into a single,
            structured platform. Managed infrastructure. Modern interface. No scattered tools.
          </p>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
              Everything your business needs
            </h2>
            <p className="text-gray-500">A complete ERP suite — clear, fast, and ready to scale.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="card hover:shadow-md hover:border-gray-300 transition-all duration-200">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
              Simple plans. Powerful ERP.
            </h2>
            <p className="text-gray-500 mb-4">
              Start today with a <strong className="text-brand-600">100% launch discount</strong> — free during early access.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium">
              ⚡ Early access pricing — plans return to list price after launch period ends
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.filter(p => !p.isCustom).map((plan) => (
              <div
                key={plan.code}
                className={`card flex flex-col relative transition-shadow ${
                  plan.isMostPopular
                    ? 'ring-2 ring-brand-500 shadow-lg shadow-brand-100'
                    : 'hover:shadow-md'
                }`}
              >
                {plan.isMostPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-snug">{plan.description}</p>
                </div>
                <div className="mb-5">
                  <div className="flex items-end gap-1.5">
                    <span className="text-3xl font-extrabold text-brand-600 tracking-tight">
                      AED {Number(plan.finalPriceAed).toFixed(0)}
                    </span>
                    <span className="text-sm text-gray-400 pb-1">/mo</span>
                  </div>
                  {Number(plan.discountPercent) > 0 && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-gray-400 line-through">
                        AED {Number(plan.listPriceAed).toFixed(0)}/mo
                      </span>
                      <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                        {Number(plan.discountPercent).toFixed(0)}% OFF
                      </span>
                    </div>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-brand-500 font-bold mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/signup?plan=${plan.code}`}
                  className={`text-center text-sm py-2.5 rounded-lg font-semibold transition-colors ${
                    plan.isMostPopular
                      ? 'bg-brand-500 text-white hover:bg-brand-600'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Get Started
                </Link>
              </div>
            ))}

            {/* Enterprise card */}
            {plans.filter(p => p.isCustom).map((plan) => (
              <div key={plan.code} className="card flex flex-col bg-gray-900 text-white hover:shadow-md transition-shadow">
                <div className="mb-4">
                  <h3 className="font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-snug">{plan.description}</p>
                </div>
                <div className="mb-5">
                  <span className="text-xl font-bold text-white">Custom pricing</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-brand-400 font-bold mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="mailto:hello@basetaa.com"
                  className="text-center text-sm py-2.5 rounded-lg font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  Contact Us
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-brand-600 text-white text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Ready to bring order to your operations?</h2>
          <p className="text-brand-200 text-lg mb-8 leading-relaxed">
            Start your trial in minutes. Full access. No setup fees. No contracts.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-white text-brand-600 font-bold px-8 py-4 rounded-lg hover:bg-brand-50 transition-colors text-base shadow-lg shadow-brand-800/20"
          >
            Start Free Trial →
          </Link>
          <p className="mt-5 text-brand-300 text-sm">
            14 days free &nbsp;·&nbsp; No credit card required
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-gray-100">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-brand-600">Basetaa</span>
            <span className="font-semibold text-gray-400"> ERP</span>
            <p className="text-xs text-gray-400 mt-1">Modern ERP for growing businesses.</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="mailto:hello@basetaa.com" className="hover:text-gray-600 transition-colors">hello@basetaa.com</a>
            <span>erp.basetaa.com</span>
            <span>© {new Date().getFullYear()} Basetaa</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
