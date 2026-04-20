import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Admin Console', template: '%s | Admin — Basetaa ERP' },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
