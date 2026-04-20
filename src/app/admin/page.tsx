import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export default async function AdminRootPage() {
  const session = await getServerSession(authOptions)
  // Paths are relative to the control subdomain view (middleware strips /admin prefix)
  redirect(session ? '/tenants' : '/login')
}
