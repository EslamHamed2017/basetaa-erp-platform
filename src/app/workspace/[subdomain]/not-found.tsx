import Link from 'next/link'

export default function WorkspaceNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-6">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Workspace not found</h1>
        <p className="text-gray-600 mb-8">
          This workspace doesn&apos;t exist or may have been removed. Check the URL and try again.
        </p>
        <Link href="https://erp.basetaa.com" className="btn-primary py-3 px-8">
          Go to Basetaa ERP
        </Link>
      </div>
    </div>
  )
}
