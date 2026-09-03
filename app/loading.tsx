function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton animate-pulse rounded ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Bar className="h-7 w-48" />
          <Bar className="mt-2 h-4 w-64" />
        </div>
        <Bar className="h-9 w-36" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-card p-5">
            <div className="flex items-start justify-between">
              <Bar className="h-4 w-32" />
              <Bar className="h-5 w-20 rounded-full" />
            </div>
            <Bar className="mt-4 h-8 w-20" />
            <Bar className="mt-2 h-4 w-40" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-card p-5">
            <Bar className="h-4 w-32" />
            <Bar className="mt-1 h-3 w-40" />
            <Bar className="mt-4 h-48 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
