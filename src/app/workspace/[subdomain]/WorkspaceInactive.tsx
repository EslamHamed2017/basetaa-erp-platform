export default function WorkspaceInactive({ companyName }: { companyName: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="card text-center py-12 px-8">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5 text-xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Workspace deactivated</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            {companyName}&apos;s workspace has been suspended. To reactivate your account,
            please contact the Basetaa team.
          </p>
          <a
            href="mailto:hello@basetaa.com"
            className="btn-primary py-2.5 px-6 text-sm w-full justify-center"
          >
            Contact Support
          </a>
          <p className="mt-5 text-xs text-gray-400">
            hello@basetaa.com &nbsp;·&nbsp; We typically respond within one business day
          </p>
        </div>
      </div>
    </div>
  )
}
