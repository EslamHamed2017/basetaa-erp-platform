export default function WorkspacePending({
  companyName,
  hasFailed,
}: {
  companyName: string
  hasFailed: boolean
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="card text-center py-12 px-8">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl
            bg-gray-100">
            {hasFailed ? '⚠️' : '⏳'}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {hasFailed ? 'Setup encountered an issue' : 'Preparing your workspace'}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            {hasFailed
              ? `We ran into a problem setting up ${companyName}'s workspace. Our team has been notified and will resolve it shortly — usually within a few hours.`
              : `${companyName}'s workspace is being set up. This typically takes less than a minute. Refresh the page to check if it's ready.`}
          </p>

          {!hasFailed ? (
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary py-2.5 px-6 text-sm"
            >
              Refresh page
            </button>
          ) : (
            <a
              href="mailto:hello@basetaa.com"
              className="btn-secondary py-2.5 px-6 text-sm"
            >
              Contact support
            </a>
          )}

          <p className="mt-6 text-xs text-gray-400">
            Need help? Reach us at{' '}
            <a href="mailto:hello@basetaa.com" className="text-brand-600 hover:underline">
              hello@basetaa.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
