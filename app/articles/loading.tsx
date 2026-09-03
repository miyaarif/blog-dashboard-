function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton animate-pulse rounded ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Bar className="h-7 w-28" />
          <Bar className="mt-2 h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Bar className="h-9 w-28" />
          <Bar className="h-9 w-32" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-line bg-card p-4 sm:flex-row sm:items-center">
        <Bar className="h-8 w-full sm:min-w-[220px] sm:flex-1" />
        <Bar className="h-8 w-full sm:w-32" />
        <Bar className="h-8 w-full sm:w-32" />
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-lg border border-line bg-card sm:block">
        <div className="border-b border-line bg-page px-4 py-3">
          <Bar className="h-3 w-16" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0"
          >
            <Bar className="h-10 w-14 shrink-0" />
            <Bar className="h-4 w-3/5" />
            <Bar className="h-4 w-20 rounded-full" />
            <Bar className="ml-auto h-4 w-16 rounded-full" />
          </div>
        ))}
      </div>

      <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-line bg-card sm:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-4">
            <Bar className="h-14 w-20 shrink-0" />
            <div className="flex-1">
              <Bar className="h-4 w-3/5" />
              <div className="mt-2 flex gap-2">
                <Bar className="h-4 w-16 rounded-full" />
                <Bar className="h-4 w-14 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
