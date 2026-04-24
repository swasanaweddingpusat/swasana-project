export default function DashboardLoading() {
  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar shimmer */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        {/* Logo area */}
        <div className="h-16 border-b border-gray-200 px-5 flex items-center">
          <div className="h-6 w-36 bg-muted rounded animate-pulse" />
        </div>
        {/* Nav items */}
        <nav className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="h-5 w-5 bg-muted rounded animate-pulse shrink-0" />
              <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${55 + i * 5}%` }} />
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header shimmer */}
        <header className="h-16 bg-white border-b border-gray-200 px-4 lg:px-6 flex items-center justify-between shrink-0">
          {/* Left: title + subtitle */}
          <div className="space-y-1.5">
            <div className="h-4 w-40 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
          </div>
          {/* Right: notification bell + avatar */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
            <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
          </div>
        </header>

        {/* Main content shimmer */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-6 w-48 bg-muted rounded animate-pulse" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-9 w-28 bg-muted rounded-md animate-pulse" />
            </div>

            {/* Table shimmer */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="h-5 w-36 bg-muted rounded animate-pulse" />
                <div className="h-9 w-64 bg-muted rounded-md animate-pulse" />
              </div>
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-6 py-4 flex items-center gap-4">
                    <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="flex-1" />
                    <div className="h-4 w-16 bg-muted rounded animate-pulse" />
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
