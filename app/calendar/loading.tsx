function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton animate-pulse rounded ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Bar className="h-7 w-56" />
      <Bar className="mt-2 h-4 w-72" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-card p-4 shadow-sm">
            <Bar className="h-3 w-20" />
            <Bar className="mt-1.5 h-7 w-10" />
            <Bar className="h-3 w-16" />
            <Bar className="mt-2 h-10 w-full" />
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-line bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Bar className="h-4 w-32" />
          <div className="flex gap-2">
            <Bar className="h-8 w-40" />
            <Bar className="h-8 w-24" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Bar key={`h-${i}`} className="h-3 w-full" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <Bar key={i} className="aspect-square w-full" />
          ))}
        </div>

        <div className="mt-4 flex gap-4">
          <Bar className="h-4 w-20" />
          <Bar className="h-4 w-20" />
          <Bar className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}
