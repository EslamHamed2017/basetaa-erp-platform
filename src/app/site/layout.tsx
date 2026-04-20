import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Basetaa ERP — Modern ERP for Growing Businesses', template: '%s | Basetaa ERP' },
  description: 'Basetaa ERP helps businesses manage accounting, sales, purchasing, inventory, and operational workflows in one structured system.',
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
