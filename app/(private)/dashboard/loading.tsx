export default function DashboardLoading() {
  return (
    <div className="flex h-screen bg-gray-100 animate-pulse">
      {/* Sidebar shimmer */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 border-b border-gray-200 px-5 flex items-center">
          <div className="h-6 w-32 bg-gray-200 rounded" />
        </div>
        {/* Nav items */}
        <div className="p-4 space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="h-5 w-5 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header shimmer */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-gray-200 rounded-full" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        </header>

        {/* Main content shimmer */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-6">
            {/* Title bar */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-6 w-48 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
              </div>
              <div className="h-9 w-28 bg-gray-200 rounded-md" />
            </div>

            {/* Table shimmer */}
            <div className="bg-white rounded-lg border border-gray-200">
              {/* Table header */}
              <div className="px-6 pb-4 border-b border-gray-200 flex items-center justify-between">
                <div className="h-5 w-36 bg-gray-200 rounded" />
                <div className="h-9 w-64 bg-gray-200 rounded-md" />
              </div>
              {/* Table rows */}
              <div className="divide-y divide-gray-100">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="px-6 py-4 flex items-center gap-4">
                    <div className="h-4 w-8 bg-gray-200 rounded" />
                    <div className="h-4 w-40 bg-gray-200 rounded" />
                    <div className="h-4 w-24 bg-gray-200 rounded" />
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                    <div className="flex-1" />
                    <div className="h-4 w-16 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
